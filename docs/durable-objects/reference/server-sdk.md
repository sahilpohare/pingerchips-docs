---
sidebar_position: 4
---

# Server SDK

Write to Durable Objects from your backend. Supports Node.js and Python.

---

## Node.js

### Install

```bash
npm install pingerchips-js
```

### Setup

```js
import PingerchipsServer from 'pingerchips-js/server';

const pc = new PingerchipsServer(
  process.env.PINGER_KEY,
  process.env.PINGER_SECRET,
  { host: 'https://your-host' }  // optional, defaults to Pingerchips cloud
);
```

### Get an object handle

```js
const order = pc.object('order', 'order-42');
```

The handle is lightweight — no network call. All operations are lazy.

---

### Reading

#### `object.get(slot, default?)`

```js
const status = await order.get('status');
// "processing"

const count = await order.get('retry_count', 0);
// 0 if slot doesn't exist
```

#### `object.state()`

Returns the full state map.

```js
const state = await order.state();
// { status: "processing", assigned_to: "agent-7", retry_count: 2 }
```

---

### Writing

All write operations return `{ logId }` (plus `value` for `increment`).

#### `object.set(slot, value)`

```js
const { logId } = await order.set('status', 'shipped');
```

#### `object.setAll(map)`

Atomic multi-slot write. All slots update in a single log entry.

```js
const { logId } = await order.setAll({
  status:     'shipped',
  shipped_at: Date.now(),
});
```

#### `object.increment(slot, delta?)`

Atomic increment. `delta` defaults to `1`.

```js
const { logId, value } = await order.increment('retry_count');
// value: 3

const { logId, value } = await order.increment('score', 10);
// value: previous + 10
```

Slot is initialised to `0` if it doesn't exist.

#### `object.append(slot, item)`

Appends one item to the list stored at `slot`. Slot is initialised to `[]` if it doesn't exist.

```js
const { logId } = await order.append('history', {
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
const { logId } = await order.delete('temp_lock');
```

#### `object.transaction(fn)`

Atomic read-modify-write. The callback receives a transaction object with the same `get` / `set` / `setAll` / `increment` / `append` / `delete` API.

```js
const { logId } = await order.transaction(async (obj) => {
  const current = await obj.get('status');
  if (current !== 'processing') return; // read-only — no commit

  await obj.set('status', 'shipped');
  await obj.append('history', { event: 'shipped', at: Date.now() });
});
```

If the callback throws or returns without writing, the transaction commits with no changes.

#### `object.purge()`

Permanently deletes the object — all state and log entries.

```js
await order.purge();
```

---

### Subscribe from server

Server processes can also subscribe to real-time changes.

```js
const sub = await order.subscribe({ afterLogId: 17 });

sub.on('change', ({ key, value, previous, logId }) => {
  console.log(`${key}: ${previous} → ${value}`);
});

sub.on('batch', ({ changes, logId }) => {
  for (const { key, value } of changes) {
    console.log(`${key} → ${value}`);
  }
});

// Cleanup
sub.unsubscribe();
```

---

### Auth helper

Issue a client-side auth token:

```js
const token = pc.authenticateObject(socketId, objectType, objectKey);
// { auth: "appKey:hmac_signature" }
```

Use this in your auth endpoint — see [Auth](../cookbook/auth).

---

## Python

### Install

```bash
pip install pingerchips
```

### Setup

```python
from pingerchips import PingerChips

pc = PingerChips(
    os.environ["PINGER_KEY"],
    os.environ["PINGER_SECRET"],
    host="https://your-host",  # optional
)

order = pc.object("order", "order-42")
```

### Operations

```python
# Read
state  = await order.state()
status = await order.get("status")
count  = await order.get("retry_count", default=0)

# Write
await order.set("status", "shipped")

await order.set_all({
    "status":     "shipped",
    "shipped_at": int(time.time() * 1000),
})

result = await order.increment("retry_count")
print(result.value)  # 3

await order.append("history", {
    "event": "shipped",
    "at":    int(time.time() * 1000),
})

await order.delete("temp_lock")

# Transaction
async def fulfil(obj):
    current = await obj.get("status")
    if current == "processing":
        await obj.set("status", "shipped")

await order.transaction(fulfil)

# Purge
await order.purge()
```

---

## Agentic workflow pattern

Durable Objects are designed for multi-agent pipelines where agents need shared, persistent working memory:

```js
async function runAgent(runId, agentId, pipeline) {
  const run = pc.object('run', runId);

  // Claim a slot in the run
  await run.transaction(async (obj) => {
    const slots = await obj.get('agent_slots', {});
    slots[agentId] = { status: 'active', started_at: Date.now() };
    await obj.set('agent_slots', slots);
  });

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

The orchestrator subscribes on the client side and reacts to agent progress in real time — no polling needed.
