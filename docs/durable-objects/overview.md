---
sidebar_position: 1
---

# Durable Objects Overview

A Durable Object is a named, persistent key-value entity with a real-time subscription.

You address it by **type** and **key**. You read and write named **state slots**. Every write is logged, serialised, and survives restarts. Every subscriber sees changes in real time.

No framework to learn. No classes to extend. No handlers to register. The entire API is the SDK.

---

## Mental model

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

**State** is the materialised view — the current value of every slot, immediately readable without replaying history.

**The log** is the source of truth — every write appended immutably in order. On restart, the server rebuilds state by replaying the log. No data loss.

---

## Addressing

Objects are identified by `type` and `key`. Both are arbitrary strings — no registration or schema required.

```
type: "order"     key: "order-42"
type: "run"       key: "run-abc123"
type: "session"   key: "user-99"
type: "document"  key: "report-q3"
```

Types are a naming convention for your benefit — they have no runtime enforcement beyond routing.

---

## Key properties

- **Durable** — state survives restarts and node failures (RocksDB WAL, ring-based handoff)
- **Serialised** — all writes to one object are linearised; no write conflicts possible
- **Real-time** — every write immediately broadcasts `change` events to all subscribers
- **Resumable** — subscribers reconnect with an `afterLogId` and receive only missed changes
- **Addressable from anywhere** — server SDK, client SDK, or HTTP API

---

## When to use

| Use case | Why Durable Objects fit |
|---|---|
| AI agent run state | Agents write progress; clients see it live |
| Workflow / pipeline state | Serialised writes, durable across crashes |
| Shared working memory | Multiple agents writing to the same object |
| Approval queues | Status slot changes trigger real-time UI updates |
| Counters / rate limiters | `increment` is atomic |
| Append-only logs | `append` builds an ordered event trail |

If you need fire-and-forget broadcasting without persistence, use [Channels](/docs/sdk/channels) instead.

---

## Products that build on Durable Objects

**Chat / Sessions** is built directly on Durable Objects. Each chat thread is a Durable Object of type `"thread"`:

- `messages` slot → append-only message log
- `status`, `title`, `bot_id` slots → thread metadata
- `stream:{runId}` slot → live token accumulation during LLM runs

Everything the Chat product does, you can do directly with the Durable Objects API for your own workflows.
