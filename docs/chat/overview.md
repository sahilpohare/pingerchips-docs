---
sidebar_position: 1
---

# Chat / Sessions Overview

Pingerchips Chat is a durable, real-time messaging layer purpose-built for AI agent interactions.

Where the base Channels product delivers fire-and-forget pub/sub, Chat adds:

- **Persistent threads** — every message is stored, indexed, and replayable
- **Run lifecycle** — structured start/stream/end events for LLM generations
- **Conversation trees** — branching via `parentId` and `forkOf` for regenerate/edit flows
- **GC compaction** — automatic garbage collection that keeps WAL lean as threads grow
- **Generational archival** — threads with thousands of messages are automatically archived and transparently restored on demand

---

## Mental model

```
Thread
 └── Messages (user / assistant / tool / system)
      └── Runs (one LLM generation per run)
           └── Token stream (accumulated via set_volatile, never serialised)
```

A **thread** is the durable unit. It lives in the Durable Objects ring and is backed by Postgres for search. One WebSocket channel corresponds to one thread (`chat:v1:app:{appKey}:thread:{threadId}`).

A **run** is ephemeral — it starts when an agent begins generating and ends when it completes or is cancelled. While a run is active, token chunks arrive at up to ~1 500 tokens/second per agent; these accumulate in a per-run in-memory buffer and are flushed to the WAL every 40 ms via a `set_volatile` write (log entry only, no full snapshot). On `run:end` the buffer is flushed, the complete content is compacted into the `messages` list, and the volatile streaming slot is dropped.

---

## Comparison

| | Channels | Chat / Sessions |
|---|---|---|
| Delivery guarantee | At-most-once | Durable (WAL + Postgres) |
| History | Optional replay buffer (recent only) | Full thread history + archival |
| Structure | Arbitrary events | Typed messages + runs |
| Token streaming | Manual | Built-in rollup buffer |
| Branching | None | parentId / forkOf tree |
| Auth | HMAC app secret | Per-thread HMAC token |

---

## When to use Chat

- AI chat interfaces (customer support, copilots, assistants)
- Multi-agent pipelines where you need a durable audit log
- Any product that needs persistent, searchable conversation history

If you just need fast pub/sub without persistence, use [Channels](/docs/sdk/channels).
