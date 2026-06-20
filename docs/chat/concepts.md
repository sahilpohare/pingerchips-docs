---
sidebar_position: 2
---

# Core Concepts

## Threads

A thread is the top-level container for a conversation. It has:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique identifier |
| `app_id` | UUID | The Pingerchips app it belongs to |
| `status` | enum | `open` \| `bot` \| `pending` \| `active` \| `resolved` |
| `title` | string? | Optional display title |
| `bot_id` | UUID? | Agent assigned to this thread |
| `assigned_agent` | string? | Human agent handle (post-handoff) |
| `metadata` | map | Arbitrary key-value pairs |

Thread state is stored in the Durable Objects ring (real-time source of truth) and replicated to Postgres (search replica). You subscribe to a thread's channel to receive real-time updates:

```
chat:v1:app:{appKey}:thread:{threadId}
```

---

## Messages

Messages are the individual units of content within a thread.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique identifier |
| `thread_id` | UUID | Parent thread |
| `role` | string | `user` \| `assistant` \| `tool` \| `system` |
| `content` | map | `{"text": "..."}` or structured content |
| `run_id` | UUID? | The run that produced this message (assistant only) |
| `parent_id` | UUID? | Parent message in the conversation tree |
| `fork_of` | UUID? | Original message this was forked from (regenerate/edit) |
| `owner_client_id` | string? | Client that sent this message |
| `inserted_at` | ISO 8601 | Creation timestamp |

---

## Runs

A run represents one LLM generation cycle. It is identified by a `run_id` (UUID) and scoped to a thread. Runs have a lifecycle:

```
run:start  →  run:token (×N)  →  run:end
                     ↓
              run:suspend  →  run:resume
                     ↓
                  (cancelled)
```

During an active run, the agent pushes `run:token` events containing incremental content. These are buffered in memory (40 ms rollup) and written to the WAL as a `stream:{runId}` volatile slot — a log-only write that skips full state serialisation.

On `run:end`, the buffer flushes, the completed message is appended to the `messages` list, and the volatile slot is deleted. Subscribers receive `change` events throughout.

---

## Conversation tree

Every message has an optional `parent_id` that points to the message it was replied to. This forms a tree, not a list — essential for branching flows like regeneration and editing.

```
msg-1 (user: "What is Elixir?")
  └── msg-2 (assistant: "Elixir is a functional language...")
        ├── msg-3 (user: "Tell me more about OTP")
        │     └── msg-4 (assistant: "OTP stands for...")
        └── msg-5 [fork_of: msg-2] (assistant: "Elixir is a concurrent, functional language...")
```

When a user clicks "regenerate", the client sends a `regenerate` event. The server creates a new assistant message with `fork_of` pointing to the original, letting the UI display both branches.

---

## GC compaction

The WAL stores every change as an append-only log. Over time this grows. Chat performs automatic GC compaction on `run:end`:

1. Read current `messages` list from WAL
2. Write the consolidated list back as a single `set` operation
3. Mark the compaction point — all log entries before this are eligible for trimming

This keeps the WAL log lean. Compaction runs inside a transaction so it is safe under concurrent writers.

---

## Load older / pagination

The `load_older` client event retrieves historical messages in pages of 50, walking backwards from a `before_message_id` cursor:

```js
session.loadOlder(beforeMessageId);
// → server pushes "older_messages" reply with { messages, has_older }
```

If the thread has been archived (>500 messages, inactive >90 days), the oldest entries are replaced with an **archive stub** in the WAL:

```json
{ "archive_ref": "app_id/thread_id/before_message_id.json", "count": 520, "before_message_id": "msg-abc" }
```

`load_older` detects stubs and transparently fetches the archive, stitching pages together so the client experience is identical.

---

## Generational archival

The Archiver GenServer sweeps every 6 hours. Threads with >500 messages that have been inactive for >90 days are candidates for archival:

1. Read the oldest messages from the WAL
2. Write them to the configured archive backend (file or S3)
3. Replace them in the WAL with an archive stub — inside a transaction with a re-check guard
4. If the transaction fails (e.g. new messages arrived), the archive file is deleted and the thread is left intact

Archive adapters: `FileAdapter` (default, JSON files on disk) and `S3Adapter` (ExAws).
