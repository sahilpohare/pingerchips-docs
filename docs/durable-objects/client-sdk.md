---
sidebar_position: 5
---

# Client SDK

Subscribe to Durable Objects from the browser. Read-only — writes come from your server.

---

## Setup

```js
import Pingerchips from 'pingerchips-js';

const pc = new Pingerchips('pk_live_...', {
  authEndpoint: '/auth/durable',
});
```

---

## Subscribe to an object

```js
const order = await pc.object('order', 'order-42');
```

This joins the `durable:{appKey}:order:order-42` channel and receives a snapshot immediately.

### With resume (recommended)

Pass `afterLogId` to receive only the changes you missed since your last checkpoint:

```js
const order = await pc.object('order', 'order-42', {
  afterLogId: loadCheckpoint('order-42') ?? undefined,
});
```

If `afterLogId` is provided and the log entry is still available, the server replays all entries after that point before streaming new changes. Your event handler is called for replayed entries exactly as for new ones.

---

## Reading state

### `order.state`

The current state snapshot. Populated synchronously after the join completes (the `snapshot` event).

```js
const order = await pc.object('order', 'order-42');
console.log(order.state);
// { status: "processing", assigned_to: "agent-7", retry_count: 2 }
```

### `order.get(slot)`

Read a single slot from the current in-memory state:

```js
const status = order.get('status');
// "processing"
```

This is a synchronous read of the locally cached state — no network call.

---

## Listening for changes

### `order.on('change', handler)`

Fires on every single-slot write. Also fires for each slot in a batch write.

```js
order.on('change', ({ key, value, previous, logId }) => {
  console.log(`${key}: ${previous} → ${value} (log ${logId})`);
});
```

### `order.on('change:STATUS', handler)`

Slot-specific listener. Only fires when `status` changes.

```js
order.on('change:status', ({ value, previous, logId }) => {
  updateStatusBadge(value);
});
```

You can have multiple listeners for the same event.

### `order.on('batch', handler)`

Fires when a `setAll` or `transaction` updates multiple slots atomically. Receives the full array of changes and the shared `logId`.

```js
order.on('batch', ({ changes, logId }) => {
  for (const { key, value, previous } of changes) {
    applyChange(key, value);
  }
});
```

### `order.on('snapshot', handler)`

Fires on initial join and on reconnect. Receives the full state and the current `logId`.

```js
order.on('snapshot', ({ state, logId }) => {
  hydrate(state);
});
```

---

## Unsubscribe

```js
// Remove a specific listener
const off = order.on('change', handler);
off(); // removes this listener only

// Leave the channel entirely
order.unsubscribe();
```

After `unsubscribe()`, no further events are emitted and the WebSocket channel is left.

---

## Resumable subscribe pattern

Save the latest `logId` to local storage so reconnects never miss changes:

```js
const CHECKPOINT_KEY = 'order-42-log-id';

const order = await pc.object('order', 'order-42', {
  afterLogId: Number(localStorage.getItem(CHECKPOINT_KEY)) || undefined,
});

order.on('change', ({ key, value, logId }) => {
  applyChange(key, value);
  localStorage.setItem(CHECKPOINT_KEY, logId);
});

order.on('batch', ({ changes, logId }) => {
  for (const c of changes) applyChange(c.key, c.value);
  localStorage.setItem(CHECKPOINT_KEY, logId);
});
```

---

## React example

```jsx
import { useEffect, useState } from 'react';

function OrderStatus({ orderId }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let order;

    (async () => {
      order = await pc.object('order', orderId);
      setStatus(order.get('status'));
      order.on('change:status', ({ value }) => setStatus(value));
    })();

    return () => order?.unsubscribe();
  }, [orderId]);

  return <span>{status ?? 'loading...'}</span>;
}
```

---

## Connection state

The client SDK surfaces connection state via events on the `pc` instance:

```js
pc.on('connected',    () => console.log('connected'));
pc.on('disconnected', () => console.log('disconnected'));
pc.on('reconnected',  () => console.log('reconnected'));
```

On reconnect, all active object subscriptions automatically re-join and request any missed changes via `afterLogId`.
