---
sidebar_position: 7
---

# Architecture

## Storage layer

Chat uses a two-layer storage model:

| Layer | Role | Technology |
|---|---|---|
| **Durable Objects ring** | Real-time source of truth | RocksDB WAL + in-memory state |
| **Postgres** | Search replica, API reads | Standard relational DB |

```mermaid
graph LR
    C[Client / Agent] -->|WebSocket push| CH[ChatChannel]
    CH -->|DR.set_all\nDR.append\nDR.set_volatile| W[DurableObject.Worker\nGenServer]
    W -->|write| RDB[(RocksDB)]
    W -->|broadcast| SUB[Subscribers]
    CH -->|async| DS[DurableSync]
    DS -->|upsert| PG[(Postgres)]

    style W fill:#eff6ff,stroke:#3b82f6
    style RDB fill:#fefce8,stroke:#ca8a04
    style PG fill:#f0fdf4,stroke:#16a34a
```

Postgres is never the primary write target. It is updated asynchronously by `DurableSync` after the WAL write succeeds.

---

## WAL write path

```mermaid
sequenceDiagram
    participant C as Client / Agent
    participant CH as ChatChannel
    participant W as DurableObject.Worker
    participant R as RocksDB
    participant P as Postgres

    C->>CH: push event (send / run:token / run:end)
    CH->>CH: validate + authorize
    CH->>W: DR.set_all / append / set_volatile
    W->>W: update in-memory state
    W->>R: write log entry (+ snapshot if not volatile)
    W-->>C: broadcast change event
    CH-->>P: DurableSync upsert (async)
```

---

## Token streaming and `set_volatile`

LLM agents push tokens at up to 1,500/sec per run. Two optimisations prevent this from saturating RocksDB:

### 1. Token rollup buffer (40ms)

```mermaid
graph LR
    A[Agent: run:token ×N\n~1500/sec] --> TB[TokenBuffer\nGenServer]
    TB -->|flush every 40ms\n~25/sec| W[DurableObject.Worker]
    W -->|set_volatile| R[(RocksDB\nlog entry only)]
    W -->|change event| SUB[Subscribers]
```

### 2. `set_volatile` vs normal write

```mermaid
graph TD
    subgraph Normal ["Normal set_all"]
        N1[state_key → full_state_binary]
        N2[log_key → entry]
    end
    subgraph Volatile ["set_volatile"]
        V1[log_key → entry only]
    end

    style N1 fill:#fee2e2,stroke:#ef4444
    style N2 fill:#fef9c3,stroke:#eab308
    style V1 fill:#dcfce7,stroke:#16a34a
```

At 1,000 concurrent runs × 25 flushes/sec = 25,000 writes/sec. With `set_volatile`, each is a ~200-byte log entry. Without it, each would serialise the entire thread state — potentially MBs per write.

On crash + rehydrate, `set_volatile` log entries replay identically to normal writes. On `run:end` the volatile slot is dropped.

---

## GC compaction

The WAL log grows with every write. Chat compacts on every `run:end`:

```mermaid
graph TD
    RE[run:end] --> TX[DR transaction]
    TX --> R1[Read current messages list]
    TX --> R2[Build final message]
    TX --> W1[set_all: messages ++ new_message\nstream:runId → nil]
    W1 --> RC[Compaction baseline reset\nold log entries eligible for trim]

    style RC fill:#f0fdf4,stroke:#16a34a
```

`set_all` is atomic — the new state contains everything the preceding log entries represented, so trimming them is safe.

---

## Generational archival

```mermaid
graph TD
    AR[Archiver sweep\nevery 6h] --> FT[Find threads\n500+ messages\ninactive 90+ days]
    FT --> READ[Read oldest N messages]
    READ --> STORE[Write to archive\nfile or S3]
    STORE --> TX{DR transaction\nre-check threshold}
    TX -->|still 500+| STUB[Replace with archive stub\nin messages list]
    TX -->|new messages arrived| DEL[Delete archive file\nskip thread]

    style STUB fill:#f0fdf4,stroke:#16a34a
    style DEL fill:#fee2e2,stroke:#ef4444
```

When `load_older` hits a stub it fetches the archive transparently — the client receives a normal page.

---

## Supervision tree

```mermaid
graph TD
    CS[CoreSupervisor] --> DOP[DurableObject.Pool\nDynamicSupervisor]
    CS --> DOR[DurableObject.Registry\nRegistry]
    CS --> TBR[Chat.TokenBuffer.Registry\nRegistry]
    CS --> TBS[Chat.TokenBuffer.Supervisor\nDynamicSupervisor]
    CS --> ARC[Chat.Archiver\nGenServer · 6h sweep]
    DOP --> W1[Worker per active object\ntemporary]
    TBS --> TB1[TokenBuffer per active run\ntemporary]
```

`TokenBuffer` processes are `:temporary` — a crash during streaming is safe. `flush_and_stop` falls back to the last committed value from the Worker's in-memory state.
