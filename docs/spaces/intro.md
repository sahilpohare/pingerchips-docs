---
sidebar_position: 1
---

# Spaces

Real-time collaborative presence — cursors, members, locations, and locks.

## What it is

A Space is a named, ephemeral coordination context. No persistence — when the last member leaves, it's gone.

```mermaid
graph TD
    S["Space: doc-abc123"]
    S --> M[Members\nAlice · Bob · Carol]
    S --> C[Cursors\nAlice: 124,88 · Bob: 300,200]
    S --> L[Locations\nAlice: heading-2 · Bob: para-5]
    S --> LK[Locks\nblock-3 → Alice]

    style M fill:#eff6ff,stroke:#3b82f6
    style C fill:#fdf4ff,stroke:#a855f7
    style L fill:#f0fdf4,stroke:#16a34a
    style LK fill:#fff7ed,stroke:#f97316
```

All state is **ephemeral**. Disconnecting removes presence, cursor, location, and held locks — automatically, no cleanup needed.

## The four primitives

| Primitive | Path | Overhead |
|---|---|---|
| **Members** | Phoenix Tracker → presence events | Low |
| **Cursors** | Pure relay (`broadcast_from!`), throttled 30fps | Zero |
| **Locations** | Pure relay (`broadcast_from!`) | Zero |
| **Locks** | SpaceWorker GenServer (serialised) | Low — lock events only |

Cursors and locations bypass any server-side state entirely. Locks are the only operation that touches a GenServer.

## Event flow

```mermaid
sequenceDiagram
    participant Alice
    participant Server
    participant Bob

    Alice->>Server: join ephemeral-doc-abc123
    Server->>Alice: presence:state (current members)
    Server->>Bob: presence:join (Alice joined)

    Alice->>Server: cursor {x:124, y:88}
    Server->>Bob: cursor {client_id: alice, x:124, y:88}
    Note over Server: broadcast_from! only — no state stored

    Alice->>Server: lock:acquire {id: "block-3"}
    Server->>Server: SpaceWorker.acquire/4
    Server->>Alice: ok {status: locked}
    Server->>Bob: lock:update {id: block-3, status: locked, holder: alice}
```

## When to use

- Collaborative document / code editors
- Multiplayer canvas or whiteboard
- Any UI where you want to show who's present and what they're doing

If you need persistence, use [Durable Objects](/docs/durable-objects/intro) instead.

---

**New here?** Start with the [Quickstart](./cookbook/quickstart).

**Know what you're looking for?** Jump to the [SDK Reference](./reference/sdk).
