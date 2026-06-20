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
    participant SDK as Server SDK
    participant W as DurableObject.Worker
    participant R as RocksDB
    participant PS as Phoenix.PubSub
    participant Sub as Subscribers

    SDK->>W: GenServer.call({:set, slot, value})
    W->>W: update in-memory state map
    W->>R: write state snapshot + log entry
    W->>PS: broadcast change event
    PS-->>Sub: change / batch event
    W-->>SDK: {:ok, log_id}
```

---

## `set_volatile`: log-only writes

Used internally by Chat token streaming — skips the state snapshot write.

```mermaid
graph TD
    subgraph Normal ["Normal :set"]
        A[state_key → full state binary]
        B[log_key → entry]
    end
    subgraph Volatile [":set_volatile"]
        C[log_key → entry only]
    end

    style A fill:#fee2e2,stroke:#ef4444
    style B fill:#fef9c3,stroke:#eab308
    style C fill:#dcfce7,stroke:#16a34a
```

On crash + rehydrate, volatile log entries replay identically to normal writes.

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

    C->>DC: join durable:{appKey}:{type}:{key}
    DC->>W: get_all (state + log_id)
    W-->>DC: snapshot
    DC->>W: log entries after afterLogId (if provided)
    W-->>DC: missed changes
    DC->>C: snapshot event + replayed changes

    Note over DC,PS: Worker and Channel decoupled via PubSub
    W->>PS: broadcast on future writes
    PS-->>C: change / batch events
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
