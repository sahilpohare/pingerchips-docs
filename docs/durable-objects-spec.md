---
sidebar_position: 99
---

# Pingerchips Platform — Design Spec

> Status: **Draft v4** · Date: 2026-06-20

---

## Three Products

| Product | Channel prefix | Durability | Primary use cases |
|---|---|---|---|
| **PubSub + Pingerflows** | `l0-` (default), `l1-`, `l2-` | L0=none, L1=at-least-once, L2=exactly-once | notifications, feeds, alerts, inflight transforms |
| **Spaces** | `ephemeral-`, `presence-` | none (ephemeral) | live cursors, multiplayer, collaborative editing |
| **Durable Workers** | `durable-` | CP, RocksDB | agentic state, workflows, shared working memory |

Chat is a wrapper on Durable Workers — thread metadata + message log are object state + append log.

---

## Product 1 — PubSub + Pingerflows

### Durability Levels

| Level | Guarantee | Serial | ReplayBuffer | WAL | NATS cross-region |
|---|---|---|---|---|---|
| L0 | Fire and forget | no | no | no | no |
| L1 | At-least-once | yes | yes | no | yes |
| L2 | Exactly-once | yes | yes | yes | yes |

Channel type is determined by topic prefix at connect time. Zero runtime branching — separate channel modules, separate code paths, no shared hot-path code.

```elixir
# user_socket.ex
channel("app:*:room:l1-*",  QueueProcessorExWeb.L1Channel)
channel("app:*:room:l2-*",  QueueProcessorExWeb.L2Channel)
channel("app:*",            QueueProcessorExWeb.RoomChannel)  # L0 default
```

L0 hot path: `broadcast_from!` + nothing else. No ULID, no serial, no ReplayBuffer write, no Jason.encode! for metrics.

### Channel Semantics (Ably Parity)

#### Channel State Machine

Channels expose an explicit state machine to the client SDK. No more silent failures.

```
initialized → attaching → attached → detaching → detached
                                   ↘ suspended → (auto-reattach on reconnect)
                                   ↘ failed
```

- `suspended` — connection dropped, channel will auto-reattach. Missed messages replayed on reattach if within history window. App code does nothing.
- `failed` — unrecoverable (auth failure, app disabled). Fires `error` event.

```js
const ch = await pingerchips.subscribe('orders');

ch.on('stateChange', ({ current, previous, reason }) => {
  if (current === 'suspended') showOfflineBanner();
  if (current === 'attached')  hideOfflineBanner();
});
```

#### `clientId`

Declared at connection time. Stamped on every published message by the server. Cannot be spoofed — server verifies it matches the token claim.

```js
const pingerchips = new Pingerchips('APP_KEY', {
  authEndpoint: '/auth',
  clientId: 'user-99',       // declared at connect
});

ch.bind('message', ({ data, clientId }) => {
  console.log(clientId);     // always server-verified, never client-provided
});
```

Server stamps `clientId` from `socket.assigns.client_id` (set at connect from token claim). Client cannot send a `clientId` in the message payload — it is stripped and overwritten.

#### Publish Ack + Idempotent Publish

`trigger()` returns a Promise that resolves when the server acks. Unack'd messages are queued and retransmitted on reconnect.

```js
// Fire and confirm
await ch.trigger('order:update', { status: 'shipped' });

// Idempotent — safe to retry; server deduplicates within window
await ch.trigger('order:update', payload, { msgSerial: 'client-uuid-123' });
```

Wire: `handle_in` already returns `{:reply, :ok, socket}`. SDK surfaces the reply as a Promise resolution. `msgSerial` stored in a per-connection ETS dedup window (5 minute TTL).

#### Channel Modes

Per-attach permission flags. Server enforces — not just naming convention.

```js
// Subscribe-only — cannot publish
const ch = await pingerchips.subscribe('prices', {
  modes: ['SUBSCRIBE'],
});

// Presence-only subscriber
const ch = await pingerchips.subscribe('presence-room-1', {
  modes: ['PRESENCE_SUBSCRIBE'],
});
```

Modes: `PUBLISH`, `SUBSCRIBE`, `PRESENCE`, `PRESENCE_SUBSCRIBE`. Default: `PUBLISH | SUBSCRIBE`. Encoded in join payload, validated in `ChannelAuth`.

#### `channel.history()`

Client-callable history fetch. Explicit query, separate from reconnect replay.

```js
// Last 100 messages
const page = await ch.history({ limit: 100 });
page.items.forEach(msg => console.log(msg));

// Paginate
if (page.hasNext()) {
  const next = await page.next();
}

// From a specific serial
const page = await ch.history({ afterSerial: 4200, limit: 50 });
```

Maps to HTTP endpoint. `ReplayBuffer` already stores data — add a client-accessible route:

```
GET /api/v1/channels/{channel}/history?limit=N&after_serial=N
```

Signed with `X-App-Key` + `X-Signature` from server SDK, or with channel auth token from client SDK.

#### Occupancy Events

Subscribe to live occupancy metrics for any channel. No polling.

```js
const meta = await pingerchips.subscribe('[meta]occupancy:orders');

meta.bind('message', ({ data }) => {
  console.log(data.metrics);
  // { connections: 142, publishers: 12, subscribers: 130, presenceMembers: 8 }
});
```

Implemented as a Phoenix PubSub topic `occupancy:{app_id}:{channel}`. `Phoenix.Tracker` diffs drive the broadcasts. Occupancy events fire on member join/leave.

#### Channel Namespace Config

Wildcard namespace config. Applied to all channels matching the pattern.

```js
// Server SDK / dashboard config
pingerchips.namespaces.set('chat:*', {
  durability: 'l1',
  historyTtl: '2h',
  maxMessageSize: 65536,
  pushEnabled: true,
});
```

Stored per-app in Postgres. ETS-cached. Lookup at join by matching channel name against configured prefixes (longest match wins).

#### Message Extras

Arbitrary metadata bag on every message.

```js
await ch.trigger('alert', payload, {
  extras: {
    headers: { 'x-trace-id': 'abc123' },
    push: {                              // trigger push notification alongside realtime
      notification: { title: 'New alert', body: payload.message },
    },
  },
});
```

`extras` passed through as-is on the wire. `extras.push` triggers push dispatch on the server after broadcast. `extras.headers` forwarded to flow engine as metadata.

#### NATS Cross-Region (L1/L2)

Publisher acks after local WAL write (~1ms). Async cross-region replication via NATS JetStream sharded streams.

```
16 streams: pingerchips.l1.{0..15}
Subject per channel: pingerchips.l1.{shard}.{app_id}.{channel}
Shard = hash(app_id) % 16
```

Each region mirrors all 16 streams. Subscriber in any region receives within speed-of-light + ~1ms replication lag. Synchronous global ack is physically impossible — sub-10ms global latency requires async replication.

---

### Zero-Cost Abstractions — Current Hot Path Problems

Today's "L0" pays full L1 cost. Every `broadcast_passthrough` call:

| Overhead | Location | Cost | Fix |
|---|---|---|---|
| `AdapterDispatch.impl/0` | `MessageQueue`, `ReplayBuffer`, `SerialCounter` | `System.get_env` + `Enum.find_value` per call | compile-time `@impl_module Application.compile_env(...)` |
| `Envelope.wrap` | every broadcast | ULID alloc + serial GenServer call | skip on L0, only on L1/L2 |
| `ReplayBuffer.store` | `broadcast_passthrough` | unconditional ETS write, no config check | removed from L0 path entirely |
| `record_sent_metrics` | every broadcast | `Jason.encode!` full payload for byte count | `:erlang.external_size/1` |
| Single wildcard route | `UserSocket` | no L0/L1/L2 isolation | topic prefix routing |

---

## Product 2 — Spaces (Collaborative Real-Time)

### What Spaces Are

A Space is a named, ephemeral coordination context for users working together on the same thing. It has no persistence — when the last member leaves, it's gone. It combines:

- **Cursors** — sub-100ms position updates
- **Members** — who's present, with rich state (avatar, role, color)
- **Locations** — what each member is looking at (selected element, scroll position)
- **Locks** — ephemeral distributed mutex (prevent edit conflicts)

### SDK

```js
import { Pingerchips } from 'pingerchips-js';

const client = new Pingerchips('APP_KEY', {
  clientId: 'user-99',
  authEndpoint: '/auth',
});

const space = client.spaces.get('doc-abc123');
await space.enter({ name: 'Alice', color: '#FF0099', avatar: 'https://...' });

// --- Cursors ---
space.cursors.set({ position: { x: 124, y: 88 } });

space.cursors.subscribe('update', ({ member, position }) => {
  renderCursor(member.clientId, position);
});

// --- Members ---
space.members.subscribe('enter',  (member) => addMember(member));
space.members.subscribe('leave',  (member) => removeMember(member));
space.members.subscribe('update', (member) => updateMember(member));

const all = await space.members.getAll();

// --- Locations ---
space.locations.set({ elementId: 'heading-2', range: { start: 4, end: 12 } });

space.locations.subscribe('update', ({ member, currentLocation, previousLocation }) => {
  updateLocationIndicator(member, currentLocation);
});

// --- Locks ---
const lock = await space.locks.acquire('block-3');
// lock.status: 'locked' | 'pending' | 'unlocked'

space.locks.subscribe('update', ({ id, status, member }) => {
  setBlockLocked(id, status === 'locked' && member.clientId !== myClientId);
});

await space.locks.release('block-3');

// --- Leave ---
await space.leave();
```

### Wire Layer

Spaces sit on top of two channel types:

| Channel | Purpose |
|---|---|
| `ephemeral-cursors-{spaceId}` | cursor + location updates — pure relay, zero overhead |
| `presence-members-{spaceId}` | member join/leave/update — Phoenix Tracker |
| `ephemeral-locks-{spaceId}` | lock acquire/release events |

`SpaceWorker` GenServer (under vnode) serialises lock acquire/release. Lock state is in-memory only — no persistence. On holder disconnect (via Tracker diff), lock is automatically released and `update` event fired.

### Cursor Throttle

Client-side throttle, default 30fps. Drop frames silently — stale cursor position is correct behavior.

```js
space.cursors.set(position, { throttle: 30 }); // max 30 updates/sec
```

At 60fps × 100 members = 6,000 events/sec. Client-side throttle brings this to 3,000. Server path is `broadcast_from!` only — no serialisation, no storage, no metrics overhead.

### EphemeralChannel

Zero-overhead channel module. Hot path is a single `broadcast_from!`.

```elixir
defmodule QueueProcessorExWeb.EphemeralChannel do
  use Phoenix.Channel

  def join("app:" <> topic_suffix, _payload, socket) do
    with [_app_key, "room", "ephemeral-" <> _] <- String.split(topic_suffix, ":", parts: 3) do
      channel = Topic.channel_from_topic(socket.topic)
      QueueProcessorExWeb.Tracker.track(socket, socket.topic, socket.id, %{
        joined_at: System.system_time(:millisecond)
      })
      push(socket, "presence:state", presence_list(socket.topic))
      {:ok, socket}
    else
      _ -> {:error, %{reason: "topic must start with ephemeral-"}}
    end
  end

  # Pure relay — no envelope, no serial, no ReplayBuffer
  def handle_in(event, payload, socket) do
    broadcast_from!(socket, event, payload)
    {:noreply, socket}
  end
end
```

---

## Product 3 — Durable Workers

### Constraint

Users only have access to the SDK. No server-side handler registration, no framework code, no deploy step. The entire API surface is the SDK.

### The Core Idea

A **Durable Object** is a named, persistent key-value entity with a real-time subscription. You address it by type and key. You read and write named state slots. Every write is logged, serialised, and survives restarts.

Think of it as a shared, persistent variable that:
- is addressable from any SDK, anywhere
- serialises concurrent writes automatically
- streams changes to every subscriber in real-time
- lets agents reconnect and replay what they missed

No framework to learn. No classes to extend. No handlers to register.

### Mental Model

```
┌───────────────────────────────────────────────────┐
│  Durable Object  "order" / "order-42"             │
│                                                   │
│  State slots (key → value, any JSON):             │
│    status        →  "shipped"                     │
│    assigned_to   →  "agent-7"                     │
│    retry_count   →  3                             │
│    history       →  [{...}, {...}, {...}]          │
│                                                   │
│  Append-only log (what changed, in order):        │
│    1  set    status       "pending"               │
│    2  set    assigned_to  "agent-7"               │
│    3  set    status       "processing"            │
│    4  inc    retry_count  1                       │
│    5  set    status       "shipped"               │
└───────────────────────────────────────────────────┘
```

State is the materialised view. The log is the source of truth. On restart the server rebuilds state by replaying the log — no data loss.

### Addressing

```
type:  "order"     key: "order-42"
type:  "run"       key: "run-abc123"
type:  "session"   key: "user-99"
type:  "document"  key: "report-q3"
```

Types are arbitrary strings — no registration needed.

### JS Client SDK

Read-only. Writes come from your backend via the server SDK.

```javascript
import Pingerchips from 'pingerchips-js';

const client = new Pingerchips('APP_KEY', {
  authEndpoint: '/auth',
});

// Subscribe — snapshot immediately, then live updates
const order = await client.object('order', 'order-42');

console.log(order.state);
// { status: "processing", assigned_to: "agent-7", retry_count: 2 }

console.log(order.get('status'));  // "processing"

order.on('change', ({ key, value, previous, logId }) => {
  console.log(`${key}: ${previous} → ${value}`);
});

order.on('change:status', ({ value, previous, logId }) => {
  updateStatusBadge(value);
});

order.unsubscribe();
```

#### Resumable Subscribe

```javascript
const order = await client.object('order', 'order-42', {
  afterLogId: loadCheckpoint('order-42'),
});

order.on('change', (entry) => {
  processChange(entry);
  saveCheckpoint('order-42', entry.logId);
});
```

### JS Server SDK

```javascript
import PingerchipsServer from 'pingerchips-js-server';

const pingerchips = new PingerchipsServer('APP_KEY', 'APP_SECRET');
const order = pingerchips.object('order', 'order-42');

// Read
const state  = await order.state();
const status = await order.get('status');
const count  = await order.get('retry_count', 0);

// Write — each returns { logId }
const { logId } = await order.set('status', 'shipped');

const { logId } = await order.setAll({
  status:     'shipped',
  shipped_at: Date.now(),
});

const { logId, value } = await order.increment('retry_count');
const { logId, value } = await order.increment('retry_count', 3);

const { logId } = await order.append('history', {
  from: 'processing',
  to:   'shipped',
  at:   Date.now(),
  by:   'agent-7',
});

const { logId } = await order.delete('temp_lock');

// Transaction — atomic read-modify-write
const { logId } = await order.transaction(async (obj) => {
  const current = await obj.get('status');
  if (current === 'processing') {
    await obj.set('status', 'shipped');
    await obj.append('history', { event: 'shipped', at: Date.now() });
  }
});

// Subscribe from server
const sub = await order.subscribe();
sub.on('change', ({ key, value, previous, logId }) => { ... });
sub.unsubscribe();
```

### Python Server SDK

```python
from pingerchips import PingerChips

pc = PingerChips("APP_KEY", "APP_SECRET")
order = pc.object("order", "order-42")

state  = await order.state()
status = await order.get("status")
count  = await order.get("retry_count", default=0)

await order.set("status", "shipped")
await order.set_all({"status": "shipped", "shipped_at": int(time.time() * 1000)})
await order.increment("retry_count")
await order.append("history", {"event": "shipped", "at": int(time.time() * 1000)})
await order.delete("temp_lock")

async def transition(obj):
    current = await obj.get("status")
    if current == "processing":
        await obj.set("status", "shipped")

await order.transaction(transition)
```

### Auth

```javascript
app.post('/auth', (req, res) => {
  const { socket_id, object_type, object_key, auth_info } = req.body;
  const user = verifySession(auth_info.token);
  if (!user || !user.canRead(object_type, object_key)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(pingerchips.authenticateObject(socket_id, object_type, object_key));
});
```

### Agentic Workflow Pattern

```javascript
async function runAgent(runId, agentId) {
  const pingerchips = new PingerchipsServer('APP_KEY', 'APP_SECRET');
  const run = pingerchips.object('run', runId);

  await run.transaction(async (obj) => {
    const slots = await obj.get('agent_slots', {});
    slots[agentId] = { status: 'active', started_at: Date.now() };
    await obj.set('agent_slots', slots);
  });

  try {
    for (const step of pipeline) {
      const result = await step.execute();
      await run.append('steps', { agent: agentId, step: step.name, result });
      await run.set(`agents.${agentId}.last_step`, step.name);
    }
    await run.set(`agents.${agentId}.status`, 'done');
  } catch (err) {
    await run.set(`agents.${agentId}.status`, 'failed');
    await run.set(`agents.${agentId}.error`, err.message);
  }
}

// Orchestrator
const run = await client.object('run', runId, { afterLogId: checkpoint });

run.on('change:status', ({ value }) => {
  if (value === 'done') markComplete();
});
```

### Wire Events

Topic: `durable:{app_key}:{type}:{key}`

On join — `snapshot`:
```json
{ "event": "snapshot", "state": { "status": "processing", "retry_count": 2 }, "log_id": 17 }
```

Per write — `change` or `batch`:
```json
{ "event": "change", "key": "status", "value": "shipped", "previous": "processing", "log_id": 18 }
{ "event": "batch",  "changes": [{"key": "status", "value": "shipped"}, ...], "log_id": 18 }
```

### HTTP API

```
GET    /api/v1/objects/{type}/{key}              → full state + log_id
GET    /api/v1/objects/{type}/{key}/{slot}       → single slot value
PUT    /api/v1/objects/{type}/{key}/{slot}       → set         → { log_id }
PATCH  /api/v1/objects/{type}/{key}             → setAll      → { log_id }
POST   /api/v1/objects/{type}/{key}/increment   → increment   → { log_id, value }
POST   /api/v1/objects/{type}/{key}/append      → append      → { log_id }
DELETE /api/v1/objects/{type}/{key}/{slot}      → delete slot → { log_id }
POST   /api/v1/objects/{type}/{key}/transaction → atomic      → { log_id }
DELETE /api/v1/objects/{type}/{key}             → purge       → 204
GET    /api/v1/objects/{type}/{key}/log?after=N → replay      → [{ id, op, ... }]
```

All endpoints signed with HMAC (`X-App-Key`, `X-Signature`, `X-Timestamp`).

---

## Scale Constraint

**1,000 apps × 20 object types × 100,000 object instances = 2 billion potential objects.**

Cold objects are the default. Only objects with writes in the last 60s stay hot. Architecture must treat cold as the common case.

---

## Storage

### Why Not ClickHouse

OLAP engine. Point reads touch minimum 8,192 rows. `ReplacingMergeTree` deduplication is async — reads after writes are not consistent without `FINAL`. No transactions. Wrong tool.

**ClickHouse role:** analytics sink only. Async flush via existing `ClickhouseFlusher` pattern for audit trails, billing, cross-object queries.

### Why Not Postgres

Per-object row contention at write rates needed for agentic workloads. Row-level locking for serialised writes degrades under fan-out. Not designed for this access pattern.

### Why RocksDB

LSM-tree embedded key-value store. Runs in-process — no network round-trip.

| Operation | Latency |
|---|---|
| Point read (bloom filter + memtable) | ~10µs |
| Point write (memtable + WAL) | ~50µs |
| Prefix range scan (log replay) | ~1µs/entry sequential |
| ScyllaDB equivalent | ~1-5ms (network) |

Key prefix layout co-locates all data for one object:

```
{app_id}/{type}/{key}/state          ← current materialised state
{app_id}/{type}/{key}/log/{log_id}   ← append-only log entries, ordered
```

Rehydration = one prefix scan. Log replay = prefix scan from `log_id > N`. Both native RocksDB operations with bloom filter acceleration.

RocksDB is embedded — HA is provided by `riak_core_lite`, not RocksDB.

---

## Distribution — riak_core_lite

### Why riak_core_lite

- **Consistent hash ring** — `hash({app_id, type, key})` maps every object to a partition. ~500ns arithmetic routing, no registry lookup.
- **Vnodes** — one vnode process per partition per node. Each vnode owns a RocksDB instance.
- **Handoff** — when nodes join/leave, vnode RocksDB key range streams to new owner. Object state migrates without external store.
- **One distribution model** — replaces Horde entirely. No two gossip protocols.

### One Model: riak_core_lite Everywhere

Horde removed. `ChannelWorker` and `DurableObjectWorker` both live under `riak_core_lite` vnodes.

`ChannelWorker` is keyed by `{app_id, channel}` — identical routing key shape. Processing logic (flow execution, broadcast, NATS ack) unchanged. What changes:

- `Horde.Registry` lookup → `hash({app_id, channel})` ring arithmetic (~500ns)
- `Horde.DynamicSupervisor.start_child` → vnode `handle_command({:process, job})`
- `ensure_started/2` → gone; vnode manages worker lifetime

Idle timeout unchanged — inner worker exits after 5 minutes idle, vnode restarts it on next command. Vnode is permanent; worker is ephemeral within it.

### Full System Layout

```
┌───────────────────────────────────────────────────────────────┐
│  Each Pingerchips node                                        │
│                                                               │
│  riak_core_lite ring (64 partitions)                          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ vnode 0           vnode 1     ...     vnode N        │    │
│  │ ┌──────────────┐  ┌──────────────┐   ┌──────────┐   │    │
│  │ │ RocksDB      │  │ RocksDB      │   │ RocksDB  │   │    │
│  │ │              │  │              │   │          │   │    │
│  │ │ ChannelWorker│  │ DurableObject│   │ both...  │   │    │
│  │ │ (ephemeral)  │  │ Worker       │   │          │   │    │
│  │ └──────────────┘  └──────────────┘   └──────────┘   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  NATS JetStream (L1/L2 cross-region replication only)         │
│  ClickHouse async flush (analytics)                           │
│  Horde: removed                                               │
└───────────────────────────────────────────────────────────────┘
```

### WAL.Store.RocksDB

New implementation of existing `WAL.Store` behaviour. Zero changes to `WAL`, `WAL.Segment`, `WAL.Pool`, or any consumer.

```elixir
defmodule QueueProcessorEx.WAL.Store.RocksDB do
  @behaviour QueueProcessorEx.WAL.Store

  # open/3     → :rocksdb.open with column family per segment
  # append/3   → :rocksdb.put key={segment_id, index} value=data
  # sync/2     → :rocksdb.sync_wal
  # read_all/3 → :rocksdb.iterator prefix scan
  # rm/2       → :rocksdb.delete_range
end
```

### Handoff

```elixir
def encode_handoff_item(key, value), do: :erlang.term_to_binary({key, value})

def handle_handoff_data(bin, state) do
  {key, value} = :erlang.binary_to_term(bin)
  :rocksdb.put(state.db, key, value, [])
  {:reply, :ok, state}
end

def delete(state) do
  :rocksdb.close(state.db)
  File.rm_rf!(state.db_path)
  {:ok, state}
end
```

Object state migrates with the vnode. No external store needed for recovery.

### New Dependencies

```elixir
{:rocksdb, "~> 1.8"},           # Erlang NIF — Riak/Basho alumni
{:riak_core_lite, "~> 0.0.8"},  # ring, vnodes, handoff, gossip
```

---

## Implementation Plan

### Phase 1 — Zero-Cost L0/L1/L2 Paths

- [x] `L0Channel` — `RoomChannel` stripped: no Envelope, no ReplayBuffer, no WAL. `broadcast_from!` only.
- [ ] `L1Channel` — serial + ReplayBuffer + NATS async publish
- [ ] `L2Channel` — serial + ReplayBuffer + WAL sync + NATS ack
- [x] Wire `l1-*` / `l2-*` topic prefixes in `UserSocket`
- [x] Fix `AdapterDispatch` — `:persistent_term` resolved once at startup, ~10ns reads
- [x] Fix `record_sent_metrics` — `:erlang.external_size/1` instead of `Jason.encode!`

### Phase 2 — Channel Semantics (Ably Parity)

- [ ] Channel state machine in SDK (`initialized → attaching → attached → suspended → failed`)
- [x] `clientId` — declared at connect, stamped server-side, verified against token claim
- [ ] `trigger()` returns Promise (surfaces existing `{:reply, :ok}` from `handle_in`)
- [x] Idempotent publish — `msgSerial` dedup window in ETS (5min TTL) per connection (`PublishDedup`)
- [x] Channel modes (`PUBLISH`, `SUBSCRIBE`, `PRESENCE`, `PRESENCE_SUBSCRIBE`) in join payload + `ChannelAuth`
- [x] `channel.history()` — `ChannelHistoryController`, paginated, backed by `ReplayBuffer`
- [x] Occupancy events — `[meta]occupancy:{channel}` Phoenix PubSub topic, driven by Tracker diffs
- [ ] Channel namespace config — Postgres + ETS cache, longest-prefix match at join
- [ ] Message `extras` — `extras.headers` forwarded to flow engine, `extras.push` triggers push dispatch

### Phase 3 — Spaces

- [x] `EphemeralChannel` — `broadcast_from!` only, `ephemeral-` prefix enforced at join
- [x] `SpaceWorker` GenServer — serialises lock acquire/release, in-memory only, 10min idle eviction
- [x] Lock auto-release on socket disconnect via `terminate/2` → `SpaceWorker.release_all/3`
- [x] `lock:acquire` / `lock:release` handled in `EphemeralChannel`, routed to `SpaceWorker`
- [x] `SpaceRegistry` + `SpaceSupervisor` in `CoreSupervisor`
- [x] Cursor bypass guarantee — cursor/location events hit pure relay, never SpaceWorker
- [ ] JS SDK: `client.spaces.get(id)` → `{ enter, leave, cursors, members, locations, locks }`
- [ ] Client-side cursor throttle (default 30fps)
- [ ] Presence state diff on member update

### Phase 4 — RocksDB + WAL.Store.RocksDB

- [x] Add `{:rocksdb, "~> 1.8"}` dependency to `mix.exs`
- [x] Add `{:riak_core_lite, "~> 0.0.8"}` dependency to `mix.exs`
- [x] `WAL.Store.RocksDB` — full `WAL.Store` behaviour implementation; zero changes to existing WAL code
- [x] `WAL_STORE=rocksdb` env var selects RocksDB backend in `WAL.Pool`
- [x] `open_db/2`, `set_db/1`, `get_db/0`, `close_db/1` helpers for vnode lifecycle
- [x] Per-vnode RocksDB open/close lifecycle (`PingerVnode.init/1` / `terminate/2`)
- [ ] Tests: `WAL.Store.RocksDB` passes same test suite as `WAL.Store.File`

### Phase 5 — riak_core_lite Ring (replaces Horde)

- [x] Add `{:riak_core_lite, "~> 0.0.8"}`, remove `{:horde, "~> 0.10.0"}`
- [x] Configure ring (256 partitions default), `RING_SIZE` env var
- [x] `PingerVnode` — single vnode behaviour for channel workers + durable object workers
- [x] Each vnode opens its own RocksDB instance at startup (shared LRU cache + rate limiter via `RocksDBEnv`)
- [x] `PingerRouter` / `DurableObjectRouter` — SHA-160 ring hash, ~500ns routing
- [x] Remove `ChannelRegistry`, `ChannelSupervisor`, `WAL.Registry` (Horde), `WAL.DynamicSupervisor` (Horde)
- [x] N=1 durability risk documented; mitigation: N=3 sloppy quorums in Phase 6+

### Phase 6 — DurableObjectWorker

- [x] `DurableObject.Worker` GenServer supervised by its vnode
- [x] Operations: `set`, `set_all`, `get`, `increment`, `append`, `delete`, `transaction`
- [x] On init: prefix scan RocksDB → rebuild in-memory state map (fast path: state snapshot; recovery: full log replay)
- [x] Every write: in-memory state + RocksDB log entry + state snapshot + PubSub broadcast
- [x] 60s idle eviction; vnode keeps RocksDB open, worker exits
- [x] `DurableObject.Store` — key layout, rehydrate, log_after, purge, compact_log
- [x] `DurableObject.Router` — routes all ops to vnode; cold reads served from RocksDB without starting worker

### Phase 7 — DurableChannel + HTTP API + SDKs

- [x] `DurableChannel` Phoenix channel — snapshot on join, replay `after_log_id`
- [x] Wire `durable:*` in `UserSocket`
- [x] Auth: `ChannelAuth.validate_object/4` — app_secret (server) or HMAC token (browser)
- [x] `DurableController` — full HTTP API surface (GET/PUT/PATCH/POST/DELETE all operations)
- [x] Routes wired under `/api/v1/objects` in `Router`
- [ ] JS server SDK: `object(type, key)` → `{ get, set, setAll, increment, append, delete, transaction, state, subscribe }`
- [ ] Python server SDK: same
- [ ] JS client SDK: `client.object(type, key, opts)` → `{ state, get, on, unsubscribe }`

### Phase 8 — Chat as Durable Workers

- [ ] Chat thread = `DurableObject` type `"thread"`, key = thread ID
- [ ] Messages = `append('messages', message)` — WAL IS the message log
- [ ] Thread metadata (status, assigned_to, bot) = state slots
- [ ] `ChatChannel` becomes thin wrapper — joins `durable:*` topic
- [ ] Remove Postgres `threads` + `messages` tables (or keep as read replica for search)

### Phase 9 — Analytics + Ops

- [ ] ClickHouse `object_events` table; async flush from `DurableObjectWorker`
- [ ] RocksDB TTL compaction filter on log entries (per-type retention config)
- [ ] `log_compacted` event when `after_log_id` is behind compaction horizon
- [ ] IEX: `DurableObjectWorker.peek(type, key)`, `DurableObjectWorker.log(type, key, after: n)`

---

## Decisions

| Question | Decision |
|---|---|
| Distribution | `riak_core_lite` everywhere — one model |
| Horde | Removed entirely |
| Storage (durable objects + channel WAL) | RocksDB per vnode |
| WAL backend | `WAL.Store.RocksDB` — new impl of existing behaviour |
| Analytics | ClickHouse — unchanged async flush pattern |
| Cross-region replication | NATS JetStream, L1/L2 only, 16 sharded streams |
| L0/L1/L2 separation | Topic prefix routing → separate channel modules |
| DurableObjectWorker lifetime | 60s idle eviction, supervised by vnode |
| ChannelWorker lifetime | 5min idle timeout unchanged, supervised by vnode |
| Cold reads | Vnode reads RocksDB directly, no worker started |
| Cold writes | Vnode starts worker, rehydrates from RocksDB prefix scan |
| Chat persistence | Durable Workers — WAL is the message log |
| Ephemeral channels | `EphemeralChannel` — `broadcast_from!` only, zero overhead |
| Spaces locking | `SpaceWorker` GenServer per space, in-memory, auto-release on disconnect |

---

## Open Questions

1. **Ring size** — 64 partitions default. ~1.5M objects per partition at max scale. Tunable at cluster init only.
2. **Replication factor** — N=1 (rely on handoff) vs N=3 (Dynamo quorum). N=1 to start.
3. **Write durability** — async RocksDB (default) vs sync per-app config.
4. **Max state size** — cap at application layer (e.g. 1MB) or uncapped.
5. **Log compaction** — RocksDB TTL compaction filter (preferred) vs explicit range delete job.
6. **`channel.history()` auth** — client presents channel auth token to history endpoint, or separate signed request?
7. **Namespace config storage** — Postgres + ETS or just ETS (seeded from env/config)?
8. **LiveSync (external DB)** — Postgres logical replication → Pingerchips channel. Separate project, not in scope for v1.
