---
sidebar_position: 2
---

# Core Concepts

## Threads

A thread is the top-level container for a conversation.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique identifier |
| `app_id` | UUID | The Pingerchips app it belongs to |
| `status` | enum | `open` \| `bot` \| `pending` \| `active` \| `resolved` |
| `title` | string? | Optional display title |
| `bot_id` | UUID? | Agent assigned to this thread |
| `assigned_agent` | string? | Human agent handle (post-handoff) |
| `metadata` | map | Arbitrary key-value pairs |

Thread state is stored in the Durable Objects ring and replicated to Postgres. Subscribe via:

```
chat:v1:app:{appKey}:thread:{threadId}
```

### Thread status flow

```mermaid
stateDiagram-v2
    [*] --> open : thread created
    open --> bot : bot assigned
    bot --> pending : bot hands off
    pending --> active : human agent picks up
    active --> resolved : conversation closed
    resolved --> open : reopened
    open --> resolved : directly resolved
```

---

## Messages

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique identifier |
| `thread_id` | UUID | Parent thread |
| `role` | string | `user` \| `assistant` \| `tool` \| `system` |
| `content` | map | `{"text": "..."}` or structured content |
| `run_id` | UUID? | The run that produced this message |
| `parent_id` | UUID? | Parent in the conversation tree |
| `fork_of` | UUID? | Original message this was regenerated from |
| `owner_client_id` | string? | Client that sent this message |
| `inserted_at` | ISO 8601 | Creation timestamp |

---

## Runs

A run is one LLM generation cycle.

```mermaid
stateDiagram-v2
    [*] --> running : run:start
    running --> running : run:token ×N\n(buffered 40ms)
    running --> done : run:end\nmessage committed
    running --> suspended : run:suspend\nawaiting tool approval
    suspended --> running : run:resume
    suspended --> cancelled : cancel
    running --> cancelled : cancel
    done --> [*]
    cancelled --> [*]
```

During streaming, token chunks are buffered in a `TokenBuffer` GenServer and flushed every 40ms to the WAL as a `stream:{runId}` volatile slot. On `run:end` the final message is appended to `messages` and the volatile slot is dropped.

---

## Conversation tree

Messages form a **tree**, not a list. `parent_id` links each message to the one it replies to. `fork_of` links a regenerated message to the original.

```mermaid
graph TD
    M1["msg-1\nuser: What is Elixir?"]
    M2["msg-2\nassistant: Elixir is a functional language..."]
    M3["msg-3\nuser: Tell me more about OTP"]
    M4["msg-4\nassistant: OTP stands for..."]
    M5["msg-5 fork_of:msg-2\nassistant: Elixir is a concurrent language..."]

    M1 --> M2
    M2 --> M3
    M3 --> M4
    M2 -.->|regenerated| M5

    style M5 fill:#fef9c3,stroke:#eab308
```

When a user regenerates, the server creates a new assistant message with `fork_of` pointing to the original. Both branches exist; the UI decides which to show.

---

## GC compaction

The WAL grows with every write. Chat compacts on every `run:end`:

```mermaid
graph LR
    RE[run:end] --> R[Read messages from WAL]
    R --> W[set_all: messages ++ new_message\n+ drop stream slot]
    W --> C[Compaction baseline reset]

    style C fill:#f0fdf4,stroke:#16a34a
```

`set_all` is atomic — all preceding log entries for `messages` can be trimmed safely.

---

## Load older / pagination

`load_older` walks backwards in pages of 50, from a `before_message_id` cursor.

```mermaid
graph TD
    LO[load_older\nbefore_message_id] --> Q{First item\nis archive stub?}
    Q -->|No| RETURN[Return page from WAL]
    Q -->|Yes| FETCH[Fetch archive file\nfrom S3 / disk]
    FETCH --> STITCH[Stitch with WAL page]
    STITCH --> RETURN

    style FETCH fill:#eff6ff,stroke:#3b82f6
```

Archive stubs are transparent to the client — it always receives a normal `{ messages, has_older }` page.
