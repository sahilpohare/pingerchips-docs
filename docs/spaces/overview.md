---
sidebar_position: 1
---

# Spaces Overview

Spaces is Pingerchips's real-time collaborative layer — built for users working together on the same thing at the same time.

A **Space** is a named, ephemeral coordination context. It has no persistence. When the last member leaves, it vanishes. It is designed for the high-frequency, low-value updates that collaborative interfaces need:

- **Cursors** — live pointer positions, sub-100ms latency, client-side throttled
- **Members** — who's in the space, with rich profile state (avatar, color, role)
- **Locations** — what each member is focused on (selected element, scroll position, viewport)
- **Locks** — ephemeral distributed mutex to prevent edit conflicts

---

## Mental model

```
Space "doc-abc123"
  ├── Members      { Alice, Bob, Carol }
  ├── Cursors      { Alice: {x:124, y:88}, Bob: {x:300, y:200} }
  ├── Locations    { Alice: {elementId: "heading-2"}, Bob: {elementId: "para-5"} }
  └── Locks        { "block-3": { holder: "Alice", status: "locked" } }
```

All state is **ephemeral** — it lives only while members are connected. On disconnect, cursor and location state disappears automatically. Locks held by a disconnected member are automatically released.

---

## How it works under the hood

Spaces sit on the `EphemeralChannel` — a zero-overhead channel module that relays events via a single `broadcast_from!` call with no serialisation, no WAL, no flow engine. At 100 users × 30fps = 3,000 cursor events/sec, the hot path must be trivially cheap.

```
app:{appKey}:room:ephemeral-{spaceId}
```

One WebSocket channel per space. All Spaces features (cursors, presence, locations, locks) share this channel.

Locks are the one exception that requires server-side coordination. They are serialised through a `SpaceWorker` GenServer (one per space) to prevent two members from acquiring the same lock simultaneously. Lock events bypass the pure relay path.

---

## When to use Spaces

| Use case | Features needed |
|---|---|
| Collaborative document editor | Cursors, locations, locks |
| Multiplayer canvas / whiteboard | Cursors, members |
| Live code editor | Cursors, locations, locks |
| Video call sidebar (who's watching) | Members only |
| Presence indicators in a SaaS UI | Members only |

If you need persistence across sessions, use [Durable Objects](/docs/durable-objects/overview) or [Chat](/docs/chat/overview) instead.

---

## Comparison to Channels

| | Channels (ephemeral-) | Spaces |
|---|---|---|
| Delivery guarantee | None (fire-and-forget) | None (fire-and-forget) |
| Persistence | No | No |
| Presence tracking | Manual (Phoenix Tracker) | Built-in via `members` |
| Cursor / location abstraction | Manual | Built-in |
| Distributed locking | No | Yes (`locks`) |
| Client throttling | Manual | Built-in (default 30fps) |

Spaces is built on top of `ephemeral-` channels — it adds the SDK-level abstractions. You can use raw `ephemeral-` channels directly if you need a lower-level API.
