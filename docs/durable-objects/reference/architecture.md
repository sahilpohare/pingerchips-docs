---
sidebar_position: 8
---

# Architecture

## Storage: RocksDB per vnode

Each object's data lives in an embedded RocksDB instance — in-process, no network hop.

```mermaid
graph LR
    subgraph Key layout
        SK["{app_id}/{type}/{key}/state\n← materialised snapshot"]
        LK1["{app_id}/{type}/{key}/log/000001"]
        LK2["{app_id}/{type}/{key}/log/000002"]
        LK3["..."]
    end
```

All keys for one object share a prefix — rehydration is a single prefix scan, not a scatter-gather.

| Operation | Mechanism | Latency |
|---|---|---|
| Read (hot) | In-memory map | ~0 ns |
| Read (cold) | RocksDB bloom filter + memtable | ~10 µs |
| Write | Memtable + WAL append | ~50 µs |
| Rehydrate (snapshot) | Single key read | ~10 µs |
| Log replay | Sequential prefix scan | ~1 µs/entry |

---

## DurableObject Worker lifecycle

```mermaid
stateDiagram-v2
    [*] --> cold : object created / first access
    cold --> rehydrating : write or subscribe arrives
    rehydrating --> hot : state loaded from RocksDB
    hot --> hot : read / write / broadcast
    hot --> cold : 60s idle → GenServer exits\nRocksDB stays on vnode
    cold --> rehydrating : next access
```

The Worker serialises all writes — no per-slot locking needed. RocksDB data persists on the vnode regardless of Worker state.

---

## Write path

```mermaid
sequenceDiagram
    participant SDK as Server SDK / HTTP
    participant RT as Router (coordinator)
    participant W as Worker on each replica vnode
    participant R as RocksDB
    participant PS as Phoenix.PubSub
    participant Sub as Subscribers

    SDK->>RT: set / append / transaction
    RT->>RT: read canonical state, turn the call into ops
    RT->>W: replicate ops with the expected log_id
    W->>R: write one log entry per op (+ snapshot every 32 log ids)
    W-->>RT: ack (write quorum)
    RT->>PS: broadcast batch {changes, log_id}
    PS-->>Sub: batch event
    RT-->>SDK: {:ok, log_id}
```

---

## Log entries and snapshots

Every op is one log entry:

```
%{op: "set",    key: slot, value: term, log_id: n}
%{op: "delete", key: slot,              log_id: n}
%{op: "append", key: slot, value: item, log_id: n}   # only the appended item
```

An `append` entry holds only the new item, so appending to a long list costs O(1) on disk. The materialised state snapshot is rewritten only when a commit crosses a multiple of 32 log ids; rehydration reads the snapshot and replays the entries after it. Full-list `set` entries written by older releases still replay unchanged.

On the wire an `append` entry always appears as `{key, op: "append", item, log_id}` (`after_log_id` replay `change`, `GET /log`) and as `{key, op: "append", item}` inside a live `batch`. Clients apply it as `state[key] = [...(state[key] ?? []), item]`.

### Rolling deploys

Item-only `append` entries are written only when the `DURABLE_APPEND_OPS` flag is on **and** every ring member runs code that can replay them; otherwise appends are written as a full-list `set`. See `deploy/README.md` in the server repo for the two-release rollout and the rollback rule.

---

## Distribution: riak_core_lite ring

```mermaid
graph TD
    REQ[SDK / HTTP request] --> RT[Router\nSHA-160 hash ~500ns]
    RT --> V0[Vnode 0\nRocksDB]
    RT --> V1[Vnode 1\nRocksDB]
    RT --> VN[Vnode N\nRocksDB]
    V0 --> W0[Worker pool]
    V1 --> W1[Worker pool]

    subgraph Ring ["riak_core_lite ring — 256 partitions"]
        V0
        V1
        VN
    end
```

Routing: `partition = SHA-160(app_id <> "/" <> type <> "/" <> key) % 256` — pure arithmetic, ~500ns, no network call.

**Handoff**: when nodes join/leave, the vnode's RocksDB key range streams to the new owner. Object state migrates with the partition.

**Cold reads**: served directly by the vnode from RocksDB — no Worker started, memory proportional to active objects only.

---

## Real-time subscribe flow

```mermaid
sequenceDiagram
    participant C as Client
    participant DC as DurableChannel
    participant W as Worker / RocksDB
    participant PS as PubSub

    C->>DC: join durable:{appKey}:{type}:{key} (after_log_id?)
    DC->>PS: subscribe to the object's topic
    DC->>W: log entries after after_log_id (if provided)
    W-->>DC: missed entries
    DC->>C: replayed change events
    DC->>W: state + log_id
    DC->>C: snapshot event

    Note over DC,PS: Worker and Channel decoupled via PubSub
    W->>PS: broadcast on future writes
    PS-->>C: batch events
```

---

## Supervision tree

```mermaid
graph TD
    CS[CoreSupervisor] --> PVS[PingerVnode.Supervisor\nriak_core_lite]
    PVS --> PV0[PingerVnode 0]
    PVS --> PV1[PingerVnode 1]
    PVS --> PVN[PingerVnode N × 256]
    PV0 --> W1[DurableObject.Worker\ntemporary · 60s idle]
    CS --> DR[DurableObject.Registry\nETS]
```

Workers are `:temporary` — not restarted on crash. Next access rehydrates from RocksDB. A crashed Worker is equivalent to an evicted one.
