---
sidebar_position: 7
---

# Architecture

How Pingerchips Chat works under the hood.

---

## Storage layer

Chat uses a two-layer storage model:

| Layer | Role | Technology |
|---|---|---|
| **Durable Objects ring** | Real-time source of truth | RocksDB WAL + in-memory state |
| **Postgres** | Search replica, API reads | Standard relational DB |

Every thread maps to one Durable Object identified by `{type: "thread", key: thread_id}`. The Durable Object holds:

- **State slots** — `status`, `title`, `bot_id`, `assigned_to`, `metadata`, `messages`, `stream:{runId}`
- **Append log** — every change is recorded as an immutable log entry with a monotonic `log_id`

Postgres is updated asynchronously from the WAL via the `DurableSync` module. It is never the primary write target for chat.

---

## WAL write path

```
Client / Agent
     │
     │  Phoenix Channel push
     ▼
ChatChannel (Elixir)
     │
     ├── validate + authorize
     │
     ├── DR.set_all / DR.append / DR.set_volatile
     │         │
     │         ▼
     │   DurableObject.Worker (GenServer)
     │         │
     │         ├── update in-memory state
     │         ├── write to RocksDB
     │         └── broadcast change event
     │
     └── DurableSync → Postgres upsert (async)
```

The DurableObject.Worker is a GenServer that owns one RocksDB instance. All writes are serialised through it. There is one worker per `{app_id, type, key}` tuple, started on demand and shut down after an idle timeout.

---

## Token streaming and `set_volatile`

LLM token streaming is the highest-volume write pattern — agents push tokens at up to 1 500/sec per run. A naive implementation would write the full thread state to RocksDB on every token, which at 1 000 concurrent agents means 1.5M full-state serialisations per second.

Pingerchips solves this with two optimisations:

### 1. Token rollup buffer

Each active run has a `TokenBuffer` GenServer (keyed by `{app_id, thread_id, run_id}`). Instead of writing to the WAL on every token, the SDK accumulates content in memory and flushes every 40 ms. This reduces WAL writes from ~1 500/sec to ~25/sec per run.

### 2. `set_volatile`

The flush writes via `DR.set_volatile` — a new DurableObject operation that:

- Updates the in-memory state (so subscribers receive change events immediately)
- Writes **only the log entry** to RocksDB (`{op: "set", key: "stream:runId", value: content}`)
- **Does not** write the full state snapshot

A normal `DR.set` writes two keys: the state snapshot (`state:{prefix}`) and the log entry. For a thread with 500 messages, the state snapshot is a large binary. `set_volatile` skips it entirely.

On crash + rehydrate, the DurableObject replays its log. The `set` log entries for `stream:{runId}` reconstruct the volatile slot correctly. On `run:end` the buffer is flushed and the streaming slot is dropped, so volatile data does not outlive the run.

```
Normal set_all:
  RocksDB write: [ state_key → full_state_binary ] + [ log_key → entry ]

set_volatile:
  RocksDB write: [ log_key → entry ]  ← only this
```

At 1 000 concurrent runs × 25 flushes/sec = 25 000 log entries/sec. Without `set_volatile`, each would also write a full state snapshot — potentially MBs of data per second for large threads. With `set_volatile`, each write is a tiny log entry (~200 bytes).

---

## GC compaction

The WAL grows as log entries accumulate. Chat triggers compaction on every `run:end`:

```elixir
# Inside a DR transaction on run:end:
current_messages = DR.get(app_id, "thread", thread_id, "messages")
new_message = build_message(run)
DR.set_all(app_id, "thread", thread_id, %{
  "messages" => current_messages ++ [new_message],
  "stream:#{run_id}" => nil   # drop volatile slot
})
```

`set_all` writes the full state snapshot once, resetting the compaction baseline. All log entries written before this point can be trimmed on the next RocksDB compaction cycle.

This is safe because `set_all` is atomic and the new state contains everything the log entries represented.

---

## Generational archival

Threads accumulate unboundedly. The Archiver GenServer sweeps every 6 hours:

```
Archiver sweep
  │
  ├── Find threads: >500 messages, inactive >90 days
  │
  └── For each candidate:
        │
        ├── Read oldest N messages from WAL
        │
        ├── Write to archive backend (file or S3)
        │         archive ref = "app_id/thread_id/before_message_id.json"
        │
        └── DR transaction:
              re-check: still >500 messages? (guard against new messages)
              if yes: replace oldest messages with archive stub
              if no:  delete archive file, skip
```

The archive stub in the WAL:

```json
{
  "archive_ref": "app_id/thread_id/msg-abc.json",
  "count": 520,
  "before_message_id": "msg-abc"
}
```

When `load_older` encounters a stub, it fetches the archive file transparently and stitches the pages together. The client receives a normal `HistoryPage` — no awareness of archival.

### Archive adapters

Configure via `config :queue_processor_ex, :chat_archive_adapter, QueueProcessorEx.Chat.Archive.S3Adapter`.

| Adapter | Config keys |
|---|---|
| `FileAdapter` (default) | `:chat_archive_path` |
| `S3Adapter` | `:chat_archive_s3_bucket`, `:chat_archive_s3_prefix` |

---

## Channel wire format

All messages flow over `chat:v1:app:{appKey}:thread:{threadId}`.

### Server → Client

| Event | When | Payload |
|---|---|---|
| `snapshot` | On join | Full thread state: messages, metadata, active runs |
| `change` | On any slot update | `{slot, value, log_id}` |
| `batch` | Bulk updates | Array of `{slot, value, log_id}` |
| `run:start` | Agent starts generating | `{runId, agentId}` |
| `run:end` | Run completes | `{runId, status, messageId}` |
| `run:suspend` | Waiting for tool approval | `{runId, toolCalls}` |
| `run:resume` | Run resumed | `{runId}` |

### Client → Server

| Event | Description |
|---|---|
| `send` | Send a user message |
| `edit` | Edit a user message |
| `cancel` | Cancel an active run |
| `regenerate` | Request regeneration of an assistant message |
| `tool_approval` | Approve pending tool calls |
| `load_older` | Paginate backwards through history |

### Agent → Server

| Event | Description |
|---|---|
| `run:start` | Announce run start |
| `run:token` | Push accumulated content to token buffer |
| `run:end` | Commit final message |
| `run:suspend` | Suspend for tool approval |
| `run:resume` | Resume after tool results received |

---

## Supervision tree

```
CoreSupervisor
  ├── DurableObject.Pool          (DynamicSupervisor — one Worker per object)
  ├── DurableObject.Registry      (Registry — Worker lookup by {app_id, type, key})
  ├── Chat.TokenBuffer.Registry   (Registry — Buffer lookup by {app_id, thread_id, run_id})
  ├── Chat.TokenBuffer.Supervisor (DynamicSupervisor — one Buffer per active run)
  └── Chat.Archiver               (GenServer — sweeps every 6h)
```

`TokenBuffer` processes are `:temporary` (not restarted on crash). A crash during streaming is safe — the run will eventually call `flush_and_stop` which falls back to reading the last committed value from the Durable Object's in-memory state.
