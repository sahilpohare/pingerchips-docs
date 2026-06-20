---
sidebar_position: 3
---

# Core Concepts

## State slots

An object's **state** is a flat map of named slots. Each slot holds any JSON-serialisable value.

```js
{
  "status":      "processing",
  "assigned_to": "agent-7",
  "retry_count": 2,
  "history":     [{ "event": "created", "at": 1718884800000 }]
}
```

Slots are created on first write and deleted explicitly. No schema required.

---

## The append-only log

Every write appends an immutable entry:

```mermaid
graph LR
    subgraph Log ["Append-only log"]
        direction TB
        E1["1 · set · status · pending"]
        E2["2 · set · assigned_to · agent-7"]
        E3["3 · set_all · status:processing..."]
        E4["4 · increment · retry_count · +1"]
        E5["5 · append · history · shipped"]
        E1 --> E2 --> E3 --> E4 --> E5
    end
    subgraph State ["Materialised state"]
        S["status: processing\nretry_count: 1\nhistory: [...]"]
    end
    Log -->|replay| State

    style Log fill:#fefce8,stroke:#ca8a04
    style State fill:#f0fdf4,stroke:#16a34a
```

`log_id` is monotonically increasing, unique per object, returned on every write and included in every `change` event. State is rebuilt by replaying the log on restart — no data loss possible.

---

## Operations

| Operation | Description | Returns |
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

## Object lifecycle

```mermaid
stateDiagram-v2
    [*] --> cold : object exists in RocksDB
    cold --> rehydrating : first write or subscribe
    rehydrating --> hot : state loaded
    hot --> hot : reads / writes / broadcasts
    hot --> cold : 60s idle\nGenServer exits\nRocksDB stays
    cold --> rehydrating : next access
    hot --> [*] : purge()
    cold --> [*] : purge()
```

Objects spring into existence on first write. There is no explicit create. `purge()` permanently deletes all state and log entries.

---

## Real-time subscriptions

```mermaid
sequenceDiagram
    participant C as Client
    participant Server
    participant Other as Other writer

    C->>Server: subscribe (afterLogId: 17)
    Server->>C: snapshot {state, log_id: 20}
    Server->>C: change {key, value, log_id: 18} ← replayed
    Server->>C: change {key, value, log_id: 19} ← replayed
    Server->>C: change {key, value, log_id: 20} ← replayed

    Other->>Server: set("status", "shipped")
    Server->>C: change {key: status, value: shipped, log_id: 21}
```

Every subscriber receives changes in log order. `afterLogId` replays only missed entries — efficient RocksDB prefix scan, not a full scan.

---

## Transactions

Transactions are serialised by the Worker GenServer — only one runs at a time per object.

```mermaid
sequenceDiagram
    participant App
    participant W as Worker GenServer

    App->>W: transaction(fn)
    W->>W: lock mailbox
    W->>W: fn: get("status") → "processing"
    W->>W: fn: set("status", "shipped")
    W->>W: append log entries
    W->>W: broadcast change
    W-->>App: {logId}
    W->>W: unlock mailbox
```

If the callback throws, no writes are committed.

---

## Consistency guarantees

- **Within one object**: all writes are linearised. `increment` and `transaction` are always atomic.
- **Across objects**: no cross-object transactions. Use an orchestrating process that writes sequentially.
- **Subscribers**: change events delivered in log order — a subscriber can never see log_id N+1 before N.
