---
sidebar_position: 2
---

# Quickstart

Track an order through a fulfilment pipeline in real time.

---

## Prerequisites

- A Pingerchips app with `App Key` and `App Secret`
- Node.js 18+

---

## 1. Install

```bash
npm install pingerchips-js
```

---

## 2. Write from your server

```js
// server.js
import PingerchipsServer from 'pingerchips-js/server';

const pc = new PingerchipsServer(
  process.env.PINGER_KEY,
  process.env.PINGER_SECRET
);

const order = pc.object('order', 'order-42');

// Set individual slots
await order.set('status', 'pending');
await order.set('assigned_to', 'agent-7');

// Set multiple slots atomically
await order.setAll({
  status:    'processing',
  started_at: Date.now(),
});

// Append to a list slot
await order.append('history', {
  event: 'processing_started',
  by:    'agent-7',
  at:    Date.now(),
});

// Atomic increment
const { value } = await order.increment('retry_count');
console.log('Retry count:', value); // 1
```

---

## 3. Subscribe on the client

```js
// browser.js
import Pingerchips from 'pingerchips-js';

const pc = new Pingerchips('pk_live_...', {
  authEndpoint: '/auth/durable',
});

const order = await pc.object('order', 'order-42');

console.log(order.state);
// { status: "processing", assigned_to: "agent-7", retry_count: 1, history: [...] }

// Listen to all changes
order.on('change', ({ key, value, previous, logId }) => {
  console.log(`${key}: ${previous} → ${value} (log ${logId})`);
});

// Listen to a specific slot
order.on('change:status', ({ value }) => {
  updateStatusBadge(value);
});
```

---

## 4. Auth endpoint (server)

The client connects with a per-object HMAC token. Your server issues it:

```js
// Express route
app.post('/auth/durable', (req, res) => {
  const { socket_id, object_type, object_key } = req.body;

  // Verify the user is allowed to read this object
  if (!canUserRead(req.user, object_type, object_key)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(pc.authenticateObject(socket_id, object_type, object_key));
});
```

---

## 5. Atomic read-modify-write

Use a transaction when the new value depends on the current value:

```js
await order.transaction(async (obj) => {
  const current = await obj.get('status');
  if (current === 'processing') {
    await obj.set('status', 'shipped');
    await obj.append('history', { event: 'shipped', at: Date.now() });
  }
});
```

Transactions are linearised — no two transactions on the same object run concurrently.

---

## 6. Read the current state (HTTP)

All objects are also accessible over HTTP, authenticated with your app credentials:

```bash
curl https://your-host/api/v1/objects/order/order-42 \
  -H "X-App-Key: pk_live_..." \
  -H "X-Signature: ..." \
  -H "X-Timestamp: ..."
```

```json
{
  "state": {
    "status": "shipped",
    "assigned_to": "agent-7",
    "retry_count": 1
  },
  "log_id": 7
}
```

---

## What's next

- [Concepts](../reference/concepts) — slots, log, rehydration, log replay
- [Server SDK](../reference/server-sdk) — full Node.js and Python API reference
- [Client SDK](../reference/client-sdk) — browser subscribe, resume, events
- [HTTP API](../reference/http-api) — REST endpoints and HMAC signing
- [Auth](../cookbook/auth) — per-object token flow
- [Architecture](../reference/architecture) — RocksDB, ring routing, `set_volatile`, handoff
