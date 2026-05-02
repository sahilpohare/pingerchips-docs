---
sidebar_position: 1
---

# Client SDK (JavaScript)

`pingerchips-js` is the browser/Node.js client SDK. It wraps Phoenix Channels to provide a simple pub/sub API.

## Installation

```bash
npm install pingerchips-js
```

Requires ESM (`"type": "module"` in `package.json` or `.mjs` extension). Node.js ≥ 18 recommended for browser-compatible `fetch`.

## Initialization

```javascript
import Pingerchips from 'pingerchips-js';

const client = new Pingerchips('YOUR_APP_KEY', options);
```

The socket connects immediately on construction.

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | string | `wss://queue.pingerchips.com/socket` | WebSocket endpoint |
| `authEndpoint` | string | — | Your server's auth URL for private/presence channels |
| `authInfo` | object | `{}` | Data sent to your auth endpoint in the `auth_info` field |
| `authHeaders` | object | — | Extra HTTP headers added to auth requests |
| `params` | object | — | Extra query params added to the WebSocket connection |

### Example with authentication

```javascript
const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://queue.pingerchips.com/socket',
  authEndpoint: 'https://your-server.com/pingerchips/auth',
  authInfo: { token: userSessionToken },
});
```

---

## Subscribing to Channels

```javascript
const channel = await client.subscribe('channel-name');
```

`subscribe` returns a `Promise<ChannelWrapper>`. If already subscribed to the same channel the existing wrapper is returned.

### Public channels

```javascript
const channel = await client.subscribe('lobby');
```

No authentication required.

### Private channels

Must be prefixed with `private-`. Requires `authEndpoint` to be configured.

```javascript
const channel = await client.subscribe('private-user-123');
```

### Presence channels

Must be prefixed with `presence-`. Requires `authEndpoint` and `userData` from the auth endpoint.

```javascript
const channel = await client.subscribe('presence-room');

channel.bind('user-joined', (data) => console.log('Joined:', data.user_info));
channel.bind('user-left',   (data) => console.log('Left:',   data.user_info));
```

---

## Channel Methods

### `bind(event, callback)`

Listen for an event on the channel. Returns `this` for chaining.

```javascript
channel.bind('new-message', (data) => {
  console.log(data.text);
});
```

### `unbind(event)`

Stop listening for an event. Returns `this`.

```javascript
channel.unbind('new-message');
```

### `trigger(event, data)`

Send an event from this client to other subscribers (client-to-client). Requires **Enable Client Messages** to be on in [App Settings](/docs/app-settings).

```javascript
channel.trigger('typing', { userId: '42', isTyping: true });
```

### `leave()`

Unsubscribe from the channel and clean up.

```javascript
channel.leave();
```

---

## Client Methods

### `unsubscribe(channelName)`

Leave a channel by name.

```javascript
client.unsubscribe('lobby');
```

### `getSocketId()`

Returns the server-assigned socket ID. Used when building your own auth endpoint calls. Throws if the socket is not yet connected.

```javascript
const socketId = client.getSocketId();
```

### `getHttpEndpoint()`

Returns the HTTP base URL derived from the WebSocket endpoint (strips `/socket`, replaces `ws://` → `http://`).

```javascript
const baseUrl = client.getHttpEndpoint();
// e.g. "https://queue.pingerchips.com"
```

---

## Reconnection

The SDK reconnects automatically after disconnection (handled by the underlying Phoenix Socket). All subscribed channels are re-joined on reconnect — you do not need to re-call `subscribe`.

---

## Socket ID Availability

The socket ID is set after the first channel join completes (the server returns it in the `ok` response). Before that, `getSocketId()` throws. For private/presence channel subscriptions the SDK waits for socket ID automatically.

---

## Complete Example

```javascript
import Pingerchips from 'pingerchips-js';

const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://queue.pingerchips.com/socket',
  authEndpoint: 'https://your-app.com/pingerchips/auth',
  authInfo: { token: sessionToken },
});

// Public channel
const news = await client.subscribe('announcements');
news.bind('announcement', (data) => console.log('News:', data.message));

// Private channel
const inbox = await client.subscribe('private-user-123');
inbox.bind('notification', (data) => console.log('Notification:', data));

// Presence channel
const room = await client.subscribe('presence-lobby');
room.bind('user-joined', ({ user_info }) => addToOnlineList(user_info));
room.bind('user-left',   ({ user_info }) => removeFromOnlineList(user_info));
room.trigger('chat-message', { text: 'Hello!' });

// Cleanup
// news.leave();
// inbox.leave();
// room.leave();
```

---

## React Hook Example

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

## Next Steps

- [Server SDK](/docs/sdk/server-sdk) — trigger events from your backend
- [Channel Types](/docs/sdk/channels) — public, private, presence
- [App Settings](/docs/app-settings) — enable client messages, user authentication
