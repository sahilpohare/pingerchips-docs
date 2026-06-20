---
sidebar_position: 4
---

# Architecture

## Channel topology

All Spaces traffic flows over one Phoenix channel per space:

```
app:{appKey}:room:ephemeral-{spaceId}
```

```mermaid
graph LR
    Alice -->|WebSocket| CH[EphemeralChannel]
    Bob -->|WebSocket| CH
    Carol -->|WebSocket| CH

    CH -->|cursor / location\nbroadcast_from! only| Alice
    CH -->|cursor / location\nbroadcast_from! only| Bob
    CH -->|cursor / location\nbroadcast_from! only| Carol

    CH -->|lock:acquire\nlock:release| SW[SpaceWorker\nGenServer]
    SW -->|lock:update broadcast| CH

    style SW fill:#fff7ed,stroke:#f97316
    style CH fill:#eff6ff,stroke:#3b82f6
```

---

## Two distinct paths

```mermaid
graph TD
    EV[Incoming event] --> Q{Event type?}

    Q -->|cursor\nlocation\nany custom| RELAY[Pure relay\nbroadcast_from!\nzero overhead]
    Q -->|lock:acquire\nlock:release| SW[SpaceWorker.acquire/release\nserialised GenServer call]

    RELAY --> OUT[Broadcast to all other members]
    SW --> LU[lock:update broadcast]

    style RELAY fill:#f0fdf4,stroke:#16a34a
    style SW fill:#fff7ed,stroke:#f97316
```

Cursors and locations **never** touch the SpaceWorker. At 100 members × 30fps = 3,000 events/sec, routing them through a single GenServer mailbox would be a guaranteed bottleneck.

---

## Cursor throttle

```mermaid
sequenceDiagram
    participant App as App code
    participant SDK as Spaces SDK
    participant Server
    participant Others

    App->>SDK: cursors.set({x,y}) — 60fps
    Note over SDK: Client-side throttle\n33ms window
    SDK->>Server: cursor push — 30fps max
    Server->>Others: broadcast_from!
```

The throttle is enforced in the SDK. Intermediate positions within the 33ms window are dropped — only the latest is sent.

---

## Presence — Phoenix Tracker

```mermaid
sequenceDiagram
    participant Alice
    participant Server
    participant Bob

    Alice->>Server: join ephemeral-{spaceId}
    Server->>Server: Tracker.track(socket, topic, id, meta)
    Server->>Alice: presence:state {members: [Bob, ...]}
    Server->>Bob: presence:join {client_id: alice, profile: ...}

    Note over Server: On Alice disconnect:
    Server->>Server: Tracker detects disconnect
    Server->>Bob: presence:leave {client_id: alice}
    Server->>Server: SpaceWorker.release_all(alice)
    Server->>Bob: lock:update (any locks Alice held → unlocked)
```

No explicit cleanup needed — Tracker fires `presence:leave` and `terminate/2` releases locks on any disconnect, including crashes and network drops.

---

## Lock acquire / release

```mermaid
sequenceDiagram
    participant Alice
    participant Bob
    participant CH as EphemeralChannel
    participant SW as SpaceWorker

    Alice->>CH: lock:acquire {id: "block-3"}
    CH->>SW: SpaceWorker.acquire(app_id, space_id, "block-3", alice_socket_id)
    SW-->>CH: {:ok, :locked}
    CH->>Alice: ok {status: locked}
    CH->>Bob: lock:update {id: block-3, status: locked, holder: alice}

    Bob->>CH: lock:acquire {id: "block-3"}
    CH->>SW: SpaceWorker.acquire(...)
    SW-->>CH: {:error, :held_by_other}
    CH->>Bob: error {reason: lock held by another member}
```

`SpaceWorker` is one GenServer per `{app_id, space_id}`. All lock operations are serialised through its mailbox. Lock state is **in-memory only** — no RocksDB, no WAL. A worker crash or node restart clears all locks (equivalent to all members disconnecting simultaneously).

---

## Supervision tree

```mermaid
graph TD
    CS[CoreSupervisor] --> SR[SpaceRegistry\nRegistry]
    CS --> SS[SpaceSupervisor\nDynamicSupervisor]
    SS --> SW1[SpaceWorker: space-A\ntransient · 10min idle]
    SS --> SW2[SpaceWorker: space-B\ntransient · 10min idle]
    SS --> SWN[SpaceWorker: space-N]
```

`SpaceWorker` is `:transient` — not restarted on crash. Next lock acquire starts a fresh worker with an empty lock map. Members stay connected; only lock state is lost.

---

## Scale

| Dimension | Behaviour |
|---|---|
| Cursor fanout | O(n) `broadcast_from!` per space |
| Lock throughput | Limited by SpaceWorker mailbox — but lock events are rare vs cursors |
| Idle spaces | SpaceWorker exits after 10min; no persistent state |
| Max concurrent spaces | Unbounded — stateless relay + lazy GenServer |
