---
sidebar_position: 1
---

# Client SDK

PingerChips provides client SDKs for JavaScript and Python.

---

## JavaScript (`pingerchips-js`)

`pingerchips-js` is the browser/Node.js client SDK. It wraps Phoenix Channels to provide a simple pub/sub API.

### Installation

```bash
npm install pingerchips-js
```

Requires ESM (`"type": "module"` in `package.json` or `.mjs` extension). Node.js ≥ 18 recommended.

### Initialization

```javascript
import Pingerchips from 'pingerchips-js';

const client = new Pingerchips('YOUR_APP_KEY', options);
```

The socket connects immediately on construction.

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | string | `wss://queue.pingerchips.com/socket` | WebSocket endpoint |
| `authEndpoint` | string | — | Your server's auth URL for private/presence channels |
| `authInfo` | object | `{}` | Data sent to your auth endpoint in the `auth_info` field |
| `authHeaders` | object | — | Extra HTTP headers added to auth requests |
| `params` | object | — | Extra query params added to the WebSocket connection |

### Subscribing to Channels

```javascript
// Public channel
const channel = await client.subscribe('lobby');

// Private channel (requires authEndpoint)
const inbox = await client.subscribe('private-user-123');

// Presence channel (requires authEndpoint)
const room = await client.subscribe('presence-lobby');

// With tag filtering — only receive messages matching the ExSift query
const alerts = await client.subscribe('sensor-data', {
  filter: { 'data.level': { $eq: 'critical' } },
});

// With delta compression — server sends diffs, client applies automatically
const prices = await client.subscribe('live-prices', { delta: 'fossil' });

// With connection recovery — replay missed messages from this serial
const orders = await client.subscribe('orders', {
  after_serial: client.getLastSerial('orders'),
});
```

`subscribe` returns a `Promise<ChannelWrapper>`. If already subscribed to the same channel the existing wrapper is returned.

### Channel Methods

#### `bind(event, callback)`

Listen for an event. Returns `this` for chaining.

```javascript
channel.bind('new-message', (data) => console.log(data.text));
```

#### `unbind(event[, callback])`

Remove listener(s). Omit `callback` to remove all for the event.

#### `trigger(event, data)`

Send a client event to other subscribers. Requires **Enable Client Messages** in [App Settings](/docs/app-settings).

```javascript
channel.trigger('typing', { userId: '42', isTyping: true });
```

#### `onRecoveryFailed(callback)`

Called when the server cannot replay missed messages after reconnect.

```javascript
channel.onRecoveryFailed(({ reason, channel, afterSerial }) => {
  // reason: "position_expired" | "no_buffer"
  // Re-fetch state from your API here
});
```

#### `leave()`

Unsubscribe and clean up.

### Client Methods

#### `getLastSerial(channelName)`

Returns the last received serial for a channel. Use to checkpoint recovery across page reloads.

```javascript
// Save before unload
localStorage.setItem('ordersSerial', client.getLastSerial('orders'));

// Restore on next load
const serial = parseInt(localStorage.getItem('ordersSerial'));
const ch = await client.subscribe('orders', { after_serial: serial });
```

#### `getSocketId()`

Returns the server-assigned socket ID. Throws if not yet connected.

#### `getHttpEndpoint()`

Returns the HTTP base URL derived from the WebSocket endpoint.

#### `unsubscribe(channelName)`

Leave a channel by name.

### Reconnection & Recovery

The SDK reconnects automatically after disconnection. On reconnect, all channels are re-joined and `after_serial` is passed automatically so the server replays any missed messages.

### Complete Example

```javascript
import Pingerchips from 'pingerchips-js';

const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://queue.pingerchips.com/socket',
  authEndpoint: 'https://your-app.com/pingerchips/auth',
  authInfo: { token: sessionToken },
});

// Public channel with tag filtering
const alerts = await client.subscribe('sensor-data', {
  filter: { 'data.severity': { $gte: 2 } },
});
alerts.bind('message', (data) => console.log('Alert:', data));

// Private channel with delta compression
const prices = await client.subscribe('private-prices', { delta: 'fossil' });
prices.bind('message', (data) => updatePriceDisplay(data));

// Presence channel
const room = await client.subscribe('presence-lobby');
room.bind('user-joined', ({ user_info }) => addToOnlineList(user_info));
room.bind('user-left',   ({ user_info }) => removeFromOnlineList(user_info));
room.trigger('chat-message', { text: 'Hello!' });
```

### React Hook Example

```jsx
import { useEffect, useRef } from 'react';
import Pingerchips from 'pingerchips-js';

export function useChannel(appKey, channelName, options = {}) {
  const channelRef = useRef(null);

  useEffect(() => {
    const client = new Pingerchips(appKey, options);
    client.subscribe(channelName).then((ch) => {
      channelRef.current = ch;
    });
    return () => channelRef.current?.leave();
  }, []);

  return channelRef;
}
```

---

## Python (`pingerchips`)

### Installation

```bash
pip install pingerchips
```

Requires Python ≥ 3.10.

### Initialization

```python
from pingerchips import PingerChipsClient

client = PingerChipsClient(
    host="wss://queue.pingerchips.com",
    app_key="YOUR_APP_KEY",
    app_secret="YOUR_APP_SECRET",   # required for private/presence channels
    auto_reconnect=True,
    max_retries=5,
    initial_backoff=1.0,
)
await client.connect()
```

### Subscribing to Channels

```python
# Public channel
ch = await client.subscribe("lobby")

# Private channel (app_secret is used to auto-sign the join)
inbox = await client.subscribe("private-user-123")

# Presence channel with user data
room = await client.subscribe(
    "presence-lobby",
    user_data={"user_id": "user_123", "user_info": {"name": "Alice"}},
)

# With tag filtering
alerts = await client.subscribe(
    "sensor-data",
    filter={"data.level": {"$eq": "critical"}},
)

# With delta compression (fossil or xdelta3)
prices = await client.subscribe("live-prices", delta="fossil")

# With connection recovery
orders = await client.subscribe(
    "orders",
    after_serial=client.get_last_serial("orders"),
)
```

### Channel Methods

```python
# Listen for events
ch.on("message", lambda data: print(data))
ch.on("pingerchips:join_success", lambda data: print("socket_id:", data["socket_id"]))

# Remove listeners
ch.off("message", my_callback)   # remove specific callback
ch.off("message")                # remove all for event

# Send a client event
await ch.send("typing", {"user_id": "user_123", "typing": True})

# Wait for join to complete
joined = await ch.wait_for_join(timeout=10.0)

# Recovery failure callback
ch.on_recovery_failed(lambda data: print("recovery failed:", data["reason"]))
```

### Connection Recovery

On reconnect, all channels are automatically re-joined with `after_serial` so the server replays missed messages.

```python
# Checkpoint the serial for cross-session recovery
serial = client.get_last_serial("orders")
# Next session:
ch = await client.subscribe("orders", after_serial=serial)
```

### Complete Example

```python
import asyncio
from pingerchips import PingerChipsClient

async def main():
    client = PingerChipsClient(
        host="wss://queue.pingerchips.com",
        app_key="APP_KEY",
        app_secret="APP_SECRET",
    )
    await client.connect()

    # Public channel with tag filtering
    alerts = await client.subscribe(
        "sensor-data",
        filter={"data.level": {"$eq": "critical"}},
    )
    alerts.on("message", lambda d: print("Alert:", d))

    # Private channel with delta compression
    prices = await client.subscribe("private-prices", delta="fossil")
    prices.on("message", lambda d: print("Price:", d))

    # Presence channel
    room = await client.subscribe(
        "presence-lobby",
        user_data={"user_id": "user_1", "user_info": {"name": "Alice"}},
    )
    room.on("user-joined", lambda d: print("Joined:", d))
    room.on("user-left",   lambda d: print("Left:", d))

    await client.listen()

asyncio.run(main())
```

---

## Feature Comparison

| Feature | JS | Python |
|---|---|---|
| Public channels | ✅ | ✅ |
| Private channels | ✅ | ✅ |
| Presence channels | ✅ | ✅ |
| Tag filtering | ✅ | ✅ |
| Delta compression (fossil) | ✅ | ✅ |
| Delta compression (xdelta3) | ⚠️ fallback to full | ⚠️ fallback to full |
| Connection recovery | ✅ | ✅ |
| Auto-reconnect with serial | ✅ | ✅ |
| Client events (`trigger`/`send`) | ✅ | ✅ |
| Push token registration | ✅ | — |
| Chat (realtime) | ✅ | — |

---

## Next Steps

- [Server SDK](/docs/sdk/server-sdk) — trigger events from your backend
- [Channel Types](/docs/sdk/channels) — public, private, presence
- [App Settings](/docs/app-settings) — enable client messages, user authentication
