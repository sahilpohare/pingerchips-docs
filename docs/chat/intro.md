---
sidebar_position: 1
---

# Chat / Sessions

Durable, real-time messaging for AI agents and human conversations.

## What it is

Chat gives every conversation a persistent **thread** backed by the Durable Objects ring. Messages survive restarts. Token streams from LLMs accumulate in memory and flush to subscribers every 40ms. When a run ends, the final message is committed to the WAL and Postgres.

## Mental model

```mermaid
graph TD
    T[Thread] --> M1[Message: user]
    T --> M2[Message: assistant]
    M2 --> R[Run]
    R --> TS[Token stream\nin-memory · flushed 40ms]
    R --> FM[Final message\ncommitted on run:end]

    style TS fill:#f0f4ff,stroke:#6366f1
    style FM fill:#f0fdf4,stroke:#16a34a
```

A **thread** is the durable unit — one WebSocket channel per thread:

```
chat:v1:app:{appKey}:thread:{threadId}
```

A **run** is one LLM generation: it starts, streams tokens, and ends. Token chunks bypass full state serialisation via `set_volatile` — only a tiny log entry is written per flush, not the entire thread state.

## Run lifecycle

```mermaid
stateDiagram-v2
    [*] --> running : run:start
    running --> running : run:token (×N)
    running --> done : run:end
    running --> suspended : run:suspend
    suspended --> running : run:resume
    suspended --> cancelled : cancel
    running --> cancelled : cancel
    done --> [*]
    cancelled --> [*]
```

## When to use

- AI chat interfaces — customer support, copilots, assistants
- Multi-agent pipelines that need a durable audit log
- Any product with persistent, searchable conversation history

If you only need fast pub/sub without persistence, use [Channels](/docs/sdk/channels) instead.

---

**New here?** Start with the [Quickstart](./cookbook/quickstart) — you'll have a working chat interface in 15 minutes.

**Know what you're looking for?** Jump to the [Reference](./reference/concepts).
