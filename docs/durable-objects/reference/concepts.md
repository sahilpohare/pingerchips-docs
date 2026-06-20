---
sidebar_position: 3
---

# Core Concepts

## State slots

An object's **state** is a flat map of named slots. Each slot holds any JSON-serialisable value — string, number, boolean, array, or object.

```js
{
  "status":      "processing",
  "assigned_to": "agent-7",
  "retry_count": 2,
  "metadata":    { "source": "web", "priority": "high" },
  "history":     [{ "event": "created", "at": 1718884800000 }]
}
```

Slot names are arbitrary strings. There is no schema — you decide what slots exist. Slots are created on first write and deleted explicitly.

---

## The append-only log

Every write to an object appends an entry to its immutable log:

```
log_id | op        | key           | value
-------|-----------|---------------|-----------------------------
1      | set       | status        | "pending"
2      | set       | assigned_to   | "agent-7"
3      | set_all   | (batch)       | { status: "processing", ... }
4      | increment | retry_count   | 1 (delta)
5      | append    | history       | { event: "shipped", ... }
6      | delete    | temp_lock     | -
```

`log_id` is a monotonically increasing integer, unique per object. It is returned on every write and included in every `change` event.

The log is the source of truth. State is a materialised view derived by replaying the log. On server restart, the state is rebuilt from the log — no data loss possible.

---

## Operations

| Operation | Description | Return |
|---|---|---|
| `set(slot, value)` | Set a single slot | `{ logId }` |
| `setAll(map)` | Set multiple slots atomically | `{ logId }` |
| `get(slot)` | Read a single slot | value |
| `increment(slot, delta?)` | Atomic integer increment | `{ logId, value }` |
| `append(slot, item)` | Append to a list slot | `{ logId }` |
| `delete(slot)` | Remove a slot | `{ logId }` |
| `transaction(fn)` | Atomic read-modify-write | `{ logId }` |
| `state()` | Read full state map | object |

---

## Transactions

A transaction is a linearised read-modify-write block. All reads and writes inside the transaction are atomic — no other write can interleave.

```js
await order.transaction(async (obj) => {
  const slots = await obj.get('agent_slots', {});
  slots['agent-7'] = { status: 'active', started_at: Date.now() };
  await obj.set('agent_slots', slots);
});
```

If the transaction function throws, no writes are committed.

Transactions are serialised by the DurableObject Worker GenServer — only one transaction runs on an object at a time.

---

## Real-time subscriptions

Every write immediately broadcasts a `change` event to all subscribers on the `durable:{appKey}:{type}:{key}` channel.

### Snapshot on join

When a client subscribes, the server sends a `snapshot` event containing the full current state and the latest `log_id`:

```json
{
  "event":  "snapshot",
  "state":  { "status": "processing", "retry_count": 2 },
  "log_id": 17
}
```

### Change events

Each write produces a `change` event:

```json
{ "event": "change", "key": "status", "value": "shipped", "previous": "processing", "log_id": 18 }
```

Batch writes (`setAll`, `transaction`) produce a single `batch` event:

```json
{
  "event": "batch",
  "changes": [
    { "key": "status", "value": "shipped" },
    { "key": "shipped_at", "value": 1718884800000 }
  ],
  "log_id": 19
}
```

---

## Resumable subscribe

Clients can reconnect without missing changes by passing `afterLogId`:

```js
const order = await pc.object('order', 'order-42', {
  afterLogId: loadCheckpoint('order-42'),
});

order.on('change', (entry) => {
  processChange(entry);
  saveCheckpoint('order-42', entry.logId);
});
```

On reconnect, the server replays all log entries after `afterLogId` before sending new changes. This is a first-class operation — efficient prefix scan in RocksDB, not a full table scan.

---

## Object lifecycle

Objects are **cold by default**. A DurableObject Worker GenServer is started on demand (first write or first subscribe) and evicted after 60 seconds of idle. The RocksDB data persists on the vnode indefinitely.

On the next access after eviction, the worker rehydrates from RocksDB — either from the state snapshot (fast path, ~10µs) or by replaying the log (recovery path). From the SDK's perspective this is invisible.

There is no explicit "create" or "destroy" call. An object springs into existence on first write and can be purged explicitly:

```js
await order.purge(); // server SDK only
```

Purge deletes all state and log entries from RocksDB.

---

## Consistency guarantees

- **Within one object**: all writes are linearised. Reads always reflect the most recently committed write. `increment` and `transaction` are always atomic.
- **Across objects**: no cross-object transactions. For multi-object consistency patterns, use an orchestrator that writes sequentially.
- **Subscribers**: change events are delivered in log order. A subscriber can never see event N+1 before event N.
