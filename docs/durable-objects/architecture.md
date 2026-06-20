---
sidebar_position: 8
---

# Architecture

How Durable Objects work under the hood.

---

## Storage: RocksDB per vnode

Each object's state is stored in an embedded RocksDB instance. RocksDB runs in-process on the Pingerchips node — no network round-trip for reads or writes.

Key layout for one object:

```
{app_id}/{type}/{key}/state        ← materialised state snapshot
{app_id}/{type}/{key}/log/000001   ← log entry 1
{app_id}/{type}/{key}/log/000002   ← log entry 2
...
```

Co-locating all keys for one object under a common prefix means rehydration is a single prefix scan, not a scatter-gather query.

| Operation | Mechanism | Latency |
|---|---|---|
| Point read (hot object) | In-memory map lookup | ~0 ns |
| Point read (cold object) | RocksDB bloom filter + memtable read | ~10 µs |
| Write | Memtable write + WAL append | ~50 µs |
| Rehydrate (state snapshot) | Single RocksDB key read | ~10 µs |
| Log replay (after snapshot) | Sequential prefix scan | ~1 µs/entry |

---

## DurableObject Worker

Each active object is managed by a `DurableObject.Worker` GenServer. The worker:

1. **Rehydrates** on start — reads the state snapshot from RocksDB (or replays the log on recovery)
2. **Serialises all writes** — only one write operation runs at a time; no per-slot locking needed
3. **Broadcasts changes** — after each write, publishes a `change` or `batch` event to all subscribers via PubSub
4. **Self-evicts** after 60 seconds idle — the RocksDB data stays on the vnode; the GenServer exits to free memory

```
Write request
    │
    ▼
DurableObject.Worker (GenServer call)
    │
    ├── 1. Update in-memory state map
    ├── 2. Write log entry + state snapshot to RocksDB
    └── 3. Broadcast change via Phoenix.PubSub
```

---

## `set_volatile`: log-only writes

Not all writes need a full state snapshot. The `set_volatile` operation is used internally by the Chat token buffer — it writes only the log entry, skipping the state snapshot.

```
Normal set:
  RocksDB write: [ state_key → full_state_binary ] + [ log_key → entry ]

set_volatile:
  RocksDB write: [ log_key → entry ] only
```

On crash + rehydrate, `set_volatile` log entries are replayed exactly like normal writes — they reconstruct in-memory state correctly. The trade-off: if the object is evicted while a volatile slot is live, cold reads hit RocksDB for a prefix scan rather than a single key read.

`set_volatile` is an internal optimisation. You do not call it directly; it is used automatically for Chat token streaming slots.

---

## Distribution: riak_core_lite ring

Pingerchips runs a `riak_core_lite` consistent hash ring across all nodes. The ring has 256 partitions (configurable at cluster init). Each partition is owned by a **vnode** — a process that manages a RocksDB instance and a set of DurableObject Workers.

### Routing

Every object is routed to a vnode deterministically:

```
partition = SHA-160(app_id <> "/" <> type <> "/" <> key) % 256
```

This is pure arithmetic — ~500 ns, no registry lookup, no network call.

### Handoff

When a node joins or leaves the cluster, the ring rebalances. The RocksDB data for affected partitions streams from the old owner to the new owner via riak_core_lite handoff — object state migrates with the vnode. No external store required for recovery.

### Cold reads

Cold reads (object not in any worker's memory) are served directly by the vnode from RocksDB, without starting a Worker GenServer. This keeps memory usage proportional to active objects, not total objects.

```
Read request for cold object
    │
    ▼
Vnode
    │
    └── RocksDB.get(state_key) → return value
        (no Worker started)
```

---

## Real-time delivery

Subscribers connect to the `durable:{appKey}:{type}:{key}` Phoenix Channel.

On join:
1. Server calls `DR.get_all(app_id, type, key)` — reads state from the active Worker (or cold RocksDB read)
2. If `afterLogId` provided, server reads log entries after that point from RocksDB
3. Sends `snapshot` (full state + log_id), then replays any missed `change` events
4. Future writes on the Worker broadcast directly to all channel subscribers

The Worker and the Channel are decoupled via `Phoenix.PubSub` — the Worker does not know about subscribers.

---

## Scale characteristics

| Dimension | Design |
|---|---|
| Max objects | Unbounded (RocksDB, not in-memory map) |
| Active objects | One Worker per active object; evicted after 60s idle |
| Write throughput | ~20 000 writes/sec per vnode (RocksDB throughput) |
| Read throughput | Unlimited for hot objects (in-memory); ~100 000/sec for cold (RocksDB) |
| Ring size | 256 partitions default; tunable at cluster init only |
| Replication | N=1 (ring handoff); N=3 Dynamo quorum planned |

---

## Supervision tree

```
CoreSupervisor
  ├── PingerVnode.Supervisor     (riak_core_lite — 256 vnodes)
  │     └── PingerVnode (×256)
  │           └── DurableObject.Worker (×N, temporary, per active object)
  ├── DurableObject.Registry     (ETS — Worker lookup by {app_id, type, key})
  └── ...
```

Workers are `:temporary` — they are not restarted on crash. The next write or subscribe causes a fresh rehydration from RocksDB. This is intentional: a crashed Worker is equivalent to an evicted one.

---

## Relation to Chat

Chat is Durable Objects with a structured schema:

| Chat concept | Durable Object equivalent |
|---|---|
| Thread | Object of type `"thread"`, key = thread UUID |
| Thread metadata | State slots: `status`, `title`, `bot_id`, `assigned_to`, `metadata` |
| Message log | `append("messages", message)` |
| Active run tokens | `set_volatile("stream:{runId}", accumulated_content)` |
| `run:end` compaction | `set_all` that replaces `messages` and deletes the volatile slot |
| Archival | External archive file/S3 + archive stub in `messages` list |

The Chat product's `ChatChannel` and `DurableSync` modules are thin wrappers that add authentication, run lifecycle events, and GC compaction on top of the raw Durable Objects API.
