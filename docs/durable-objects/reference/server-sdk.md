---
sidebar_position: 4
---

# Server SDK

Write to Durable Objects from your backend. Supports Node.js and Python.

---

## Node.js

### Install

```bash
npm install pingerchips-js-server
```

### Setup

```js
import PingerchipsServer from 'pingerchips-js-server';

const pc = new PingerchipsServer(
  process.env.PINGER_KEY,
  process.env.PINGER_SECRET,
  { endpoint: 'https://your-host' }  // optional, defaults to https://queue.pingerchips.com in production
);
```

Every call is an HTTP request to [`/api/v1/objects`](./http-api) authenticated with
`X-App-Key` + `X-App-Secret`. 5xx responses are retried (`retries` option, default `2`);
any other non-2xx response throws.

### Get an object handle

```js
const order = pc.object('order', 'order-42');
```

The handle is lightweight — no network call until you use it.

---

### Reading

#### `object.get(slot)`

Resolves to the slot's value, or `null` if the slot doesn't exist.

```js
const status = await order.get('status');
// "processing"

const count = (await order.get('retry_count')) ?? 0;
```

#### `object.state()`

Resolves to the full state map and the object's current `log_id`.

```js
const { state, log_id } = await order.state();
// state:  { status: "processing", assigned_to: "agent-7", retry_count: 2 }
// log_id: 17
```

#### `object.log(afterId = 0)`

Resolves to `{ items }`: every log entry with `log_id > afterId`, in order. Use it to
catch a server process up from a checkpoint.

```js
const { items } = await order.log(17);
// [
//   { op: "set",    key: "status", value: "shipped",            log_id: 18 },
//   { op: "append", key: "history", item: { event: "shipped" }, log_id: 19 },
//   { op: "delete", key: "temp_lock",                           log_id: 20 }
// ]
```

An `append` entry carries only the appended `item`, never the whole list. To apply
entries to a local copy: `op === 'append'` → push `item` onto `state[key] ?? []`;
`op === 'delete'` → remove the slot; otherwise → `state[key] = value`.

---

### Writing

All write operations resolve to `{ log_id }` (plus `value` for `increment`).

#### `object.set(slot, value)`

```js
const { log_id } = await order.set('status', 'shipped');
```

#### `object.setAll(map)`

Atomic multi-slot write: one commit, one `batch` event.

```js
const { log_id } = await order.setAll({
  status:     'shipped',
  shipped_at: Date.now(),
});
```

#### `object.increment(slot, by = 1)`

Atomic increment. The slot is treated as `0` if it doesn't exist.

```js
const { log_id, value } = await order.increment('retry_count');
// value: 3

await order.increment('score', 10);
```

#### `object.append(slot, item)`

Appends one item to the list stored at `slot`. The slot is treated as `[]` if it doesn't exist.

```js
const { log_id } = await order.append('history', {
  event: 'status_change',
  from:  'processing',
  to:    'shipped',
  at:    Date.now(),
  by:    'agent-7',
});
```

#### `object.delete(slot)`

Removes a slot from state.

```js
const { log_id } = await order.delete('temp_lock');
```

#### `object.transaction(ops)`

Applies a list of ops atomically, in order — all commit or none do. Each op is
`{ op: 'set', key, value }`, `{ op: 'delete', key }`, `{ op: 'increment', key, by }`
or `{ op: 'append', key, value }`.

```js
const { log_id } = await order.transaction([
  { op: 'set',       key: 'status',      value: 'shipped' },
  { op: 'increment', key: 'retry_count', by: 1 },
  { op: 'append',    key: 'history',     value: { event: 'shipped', at: Date.now() } },
]);
```

The ops are fixed before they are sent: there is no server-side callback, so a
transaction cannot branch on the object's current state. If an op cannot apply (for example
`append` to a slot that is not a list) nothing commits and the call throws (HTTP `422`).

#### `object.purge()`

Permanently deletes the object — all state and log entries.

```js
await order.purge();
```

---

### Real-time changes

The server SDK is HTTP-only — it has no `subscribe()`. To react to changes in real
time, join the object's socket channel with the [Client SDK](./client-sdk). To catch up after downtime from a server process, store the last `log_id` you
handled and call `object.log(lastLogId)`.

---

### Auth helper

Issue a client-side auth token for one object:

```js
const token = pc.authenticateObject(socketId, objectType, objectKey);
// { auth: "{appKey}.{payloadB64}.{sigB64}" }
```

The token grants `object:read:{type}/{key}` bound to that socket. Use this in your
auth endpoint — see [Auth](../cookbook/auth).

---

## Python

### Install

```bash
pip install pingerchips
```

### Setup

```python
import os, time
from pingerchips import PingerChips

pc = PingerChips(
    host="https://your-host",
    app_id=os.environ["PINGER_KEY"],
    app_secret=os.environ["PINGER_SECRET"],
)

order = pc.object("order", "order-42")
```

### Operations

The Python client is synchronous. Write methods return the decoded JSON reply
(`{"log_id": ...}`, plus `"value"` for `increment`).

```python
# Read
snapshot = order.state()          # {"state": {...}, "log_id": 17}
status   = order.get("status")    # None if the slot doesn't exist
entries  = order.log(17)["items"] # log entries after log_id 17

# Write
order.set("status", "shipped")

order.set_all({
    "status":     "shipped",
    "shipped_at": int(time.time() * 1000),
})

result = order.increment("retry_count")
print(result["value"])  # 3

order.append("history", {
    "event": "shipped",
    "at":    int(time.time() * 1000),
})

order.delete("temp_lock")

# Transaction — same op list as Node.js
order.transaction([
    {"op": "set",    "key": "status",  "value": "shipped"},
    {"op": "append", "key": "history", "value": {"event": "shipped"}},
])

# Purge
order.purge()
```

---

## Agentic workflow pattern

Durable Objects are designed for multi-agent pipelines where agents need shared, persistent working memory:

```js
async function runAgent(runId, agentId, pipeline) {
  const run = pc.object('run', runId);

  // Register the agent in one atomic commit
  await run.transaction([
    { op: 'set',    key: `agents.${agentId}.status`, value: 'active' },
    { op: 'append', key: 'agent_ids',               value: agentId },
  ]);

  try {
    for (const step of pipeline) {
      const result = await step.execute();

      await run.append('steps', {
        agent: agentId,
        step:  step.name,
        result,
        at:    Date.now(),
      });

      await run.set(`agents.${agentId}.last_step`, step.name);
    }

    await run.set(`agents.${agentId}.status`, 'done');

  } catch (err) {
    await run.set(`agents.${agentId}.status`, 'failed');
    await run.set(`agents.${agentId}.error`,  err.message);
  }
}
```

The orchestrator joins the object with the [Client SDK](./client-sdk) and reacts to agent progress in real time — no polling needed.
