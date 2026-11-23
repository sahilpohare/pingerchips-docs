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
    CH -->|DR.transaction\nDR.set| W[DurableObject.Worker\nGenServer]
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
    CH->>W: DR.transaction / DR.set
    W->>W: update in-memory state
    W->>R: write one log entry per op (+ snapshot every 32 log ids)
    W-->>C: broadcast batch event
    CH-->>P: DurableSync upsert (async)
```

---

## Token streaming

LLM agents push tokens at up to 1,500/sec per run. A rollup buffer keeps this from saturating RocksDB:

```mermaid
graph LR
    A[Agent: run:token ×N\n~1500/sec] --> TB[TokenBuffer\nGenServer]
    TB -->|flush every 40ms\n~25/sec| W[DurableObject.Worker]
    W -->|log entry\nsnapshot every 32 log ids| R[(RocksDB)]
    W -->|batch event\nnew span only| SUB[Subscribers]
```

Each flush is a transaction that sets `stream:{runId}` to the text accumulated so far, and only while the run is live (a flush after the run ended writes nothing). That is one log entry holding the run's text, not the thread; the full state snapshot is rewritten only once every 32 log ids, so a 25-flush/sec run does not serialise the whole thread on every flush. Subscribers receive a `batch` whose `stream:{runId}` change carries only the new span as `append`. On crash + rehydrate, the snapshot plus the log entries after it rebuild the stream slot exactly.

---

## Run compaction

Every run ending (`run:end`, `cancel`, sweeper timeout) folds its stream into one message:

```mermaid
graph TD
    RE[run ends] --> FL[Flush TokenBuffer]
    FL --> TX[DR transaction]
    TX --> W1["append messages ← final message\nset run:{runId} status\ndelete stream:{runId}\nset last_message_id"]
    W1 --> B[batch event + DurableSync to Postgres]

    style B fill:#f0fdf4,stroke:#16a34a
```

The message is written as an item-only `append` log entry — the transaction never rewrites the whole `messages` list, so its cost does not grow with the thread.

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
