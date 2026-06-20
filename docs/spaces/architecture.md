---
sidebar_position: 4
---

# Architecture

How Spaces works under the hood.

---

## EphemeralChannel — the zero-overhead relay

All Spaces traffic flows through `EphemeralChannel`. The hot path for non-lock events is a single `broadcast_from!` call:

```elixir
def handle_in(event, payload, socket) do
  Phoenix.Channel.broadcast_from!(socket, event, payload)
  {:noreply, socket}
end
```

No envelope, no serial, no ReplayBuffer, no WAL, no flow engine. The server does exactly as much work as physically necessary to relay the event.

This matters at scale. 100 members × 30fps = 3,000 cursor events/sec in one space. If each event triggered a GenServer call, a WAL write, or even a Jason.encode!, latency would accumulate. With `broadcast_from!`, the only overhead is the Phoenix PubSub fanout.

---

## Topic structure

```
app:{appKey}:room:ephemeral-{spaceId}
```

The `ephemeral-` prefix is enforced at join — attempting to join an `ephemeral-` channel through the standard `RoomChannel` is rejected. All Spaces features (cursors, members, locations, locks) share this single channel.

---

## Presence — Phoenix Tracker

Member state (who's in the space, with what profile) is tracked via `Phoenix.Tracker`. On join, the server calls:

```elixir
Tracker.track(socket, socket.topic, socket.id, %{
  joined_at: System.system_time(:millisecond),
  client_id: socket.assigns[:client_id]
})
```

On disconnect, the Tracker automatically fires a `presence:leave` event. No explicit cleanup needed — this is the mechanism behind automatic cursor/presence removal.

The current member list is pushed to each joining member as `presence:state`. Subsequent joins/leaves are pushed as `presence:join` / `presence:leave`.

---

## Cursors and locations — pure relay

`cursor` and `location` events go through the pure relay path (`broadcast_from!`). They bypass the `SpaceWorker` entirely. This is a deliberate design choice — the BYPASS GUARANTEE:

> Cursor and location events MUST never touch the SpaceWorker GenServer. At 100 users × 30fps, that is 3,000 messages/sec through one process — a guaranteed bottleneck.

The SDK enforces a client-side throttle (default 33ms / ~30fps) to keep the per-space fanout bounded even if callers invoke `cursors.set` on every animation frame.

---

## Locks — SpaceWorker GenServer

Locks require serialisation — two members attempting to acquire the same lock simultaneously must be resolved deterministically. This is handled by `SpaceWorker`, one GenServer per `{app_id, space_id}`.

```
lock:acquire push
     │
     ▼
EphemeralChannel.handle_in("lock:acquire", ...)
     │
     ▼
SpaceWorker.acquire(app_id, space_id, lock_id, socket_id)   ← serialised GenServer call
     │
     ├── slot free?   → {:ok, :locked}  + broadcast lock:update
     └── slot taken?  → {:error, :held_by_other}
```

Lock state is purely in-memory — `SpaceWorker` holds a map of `lock_id → %{id, status, holder}`. There is no RocksDB write, no WAL entry. When the `SpaceWorker` crashes or the node restarts, all lock state is lost. This is acceptable because Spaces is ephemeral — a lost lock is no different from all members disconnecting.

`SpaceWorker` exits after 10 minutes idle. On the next lock acquire, it is started fresh with an empty lock map.

### Automatic lock release on disconnect

`EphemeralChannel.terminate/2` calls `SpaceWorker.release_all(app_id, space_id, socket_id)` on every disconnect:

```elixir
def terminate(_reason, socket) do
  SpaceWorker.release_all(socket.assigns.app_id, space_id, socket.id)
  :ok
end
```

`release_all` broadcasts `lock:update` with `status: "unlocked"` for every lock held by that socket. Subscribers see exactly the same event as an explicit `release()`.

---

## Wire events

All events flow on `app:{appKey}:room:ephemeral-{spaceId}`.

### Server → Client

| Event | When | Payload |
|---|---|---|
| `presence:state` | On join | `{ members: [{ id, client_id, joined_at, profile }] }` |
| `presence:join` | Member joins / updates profile | `{ client_id, profile, joined_at }` |
| `presence:leave` | Member leaves / disconnects | `{ client_id }` |
| `cursor` | Other member moves cursor | `{ client_id, position }` |
| `location` | Other member changes location | `{ client_id, location }` |
| `lock:update` | Lock acquired / released | `{ id, status: "locked"\|"unlocked", holder: client_id\|null }` |

### Client → Server

| Event | Description | Payload |
|---|---|---|
| `cursor` | Publish cursor position | `{ client_id, position }` |
| `location` | Publish current location | `{ client_id, location }` |
| `presence:update` | Update member profile | `{ client_id, profile }` |
| `presence:leave` | Leave the space | `{ client_id }` |
| `lock:acquire` | Acquire a named lock | `{ id }` |
| `lock:release` | Release a named lock | `{ id }` |

---

## Scale

| Dimension | Behaviour |
|---|---|
| Cursor/location fanout | O(n) `broadcast_from!` — linear in space membership |
| Lock serialisation | One SpaceWorker mailbox per space — throughput limited by lock acquire/release rate, not cursor rate |
| Idle spaces | SpaceWorker exits after 10 min idle; no persistent state |
| Space lifetime | Exists while ≥1 member connected; Tracker auto-cleans on last leave |
| Max concurrent spaces | Unbounded (stateless fanout channel + lazy SpaceWorker) |

---

## Supervision tree

```
CoreSupervisor
  ├── SpaceRegistry     (Registry — SpaceWorker lookup by {app_id, space_id})
  └── SpaceSupervisor   (DynamicSupervisor — one SpaceWorker per active space)
        └── SpaceWorker (GenServer, restart: :transient, idle: 10min)
```

`SpaceWorker` is `:transient` — it is not restarted on crash. A crash means all lock state for that space is lost. Members are not disconnected; the next lock acquire will start a fresh `SpaceWorker` with an empty lock map.
