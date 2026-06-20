---
sidebar_position: 2
---

# Server SDK

PingerChips provides server SDKs for Node.js and Python.

---

## Node.js (`pingerchips-js-server`)

`pingerchips-js-server` triggers events from your backend and generates auth signatures for private and presence channels.

## Installation

```bash
npm install pingerchips-js-server
```

Requires Node.js ≥ 14. ESM only (`"type": "module"` or `.mjs`).

## Initialization

```javascript
import PingerchipsServer from 'pingerchips-js-server';

const pingerchips = new PingerchipsServer(appKey, appSecret, options);
```

### Constructor

```javascript
new PingerchipsServer(appKey, appSecret, options)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `appKey` | string | Your App Key from the dashboard |
| `appSecret` | string | Your App Secret from the dashboard |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | string | `https://queue.pingerchips.com` | API base URL |
| `requestTimeout` | number | `10000` | Request timeout in milliseconds |
| `retries` | number | `2` | Retry count on 5xx or network errors |
| `mtls` | object | — | mTLS config (see below) |

```javascript
const pingerchips = new PingerchipsServer(
  process.env.PINGERCHIPS_APP_KEY,
  process.env.PINGERCHIPS_APP_SECRET,
  {
    endpoint: 'https://queue.pingerchips.com',
    requestTimeout: 5000,
    retries: 3,
  }
);
```

---

## Triggering Events

```javascript
await pingerchips.trigger(channel, event, data);
```

| Parameter | Type | Constraints |
|-----------|------|-------------|
| `channel` | string | Max 200 characters |
| `event` | string | Max 200 characters |
| `data` | any | JSON-serializable, max 64 KB |

Throws a `TypeError` for invalid inputs before making any network request. Throws an `Error` on non-2xx responses.

### Examples

```javascript
// Public channel broadcast
await pingerchips.trigger('announcements', 'new-post', {
  title: 'v2 Released',
  url: '/blog/v2',
});

// Private user channel
await pingerchips.trigger(`private-user-${userId}`, 'notification', {
  type: 'order-shipped',
  orderId: '12345',
});

// Presence channel update
await pingerchips.trigger('presence-game-room', 'game-state', {
  round: 3,
  timeRemaining: 45,
});
```

### How It Works

`trigger` signs the request with HMAC-SHA256 using your App Secret and sends it to:

```
POST /api/apps/{appKey}/trigger
```

See [HMAC Request Signing](/docs/hmac-signing) for the full algorithm if you need to sign requests manually.

---

## Authentication {#authentication}

Generate auth payloads for clients joining private or presence channels. Call this from your server's auth endpoint.

```javascript
pingerchips.authenticate(socketId, channelName, userData)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `socketId` | string | Yes | Socket ID from the client (`client.getSocketId()`) |
| `channelName` | string | Yes | Must start with `private-` or `presence-` |
| `userData` | object | Presence only | Must include `user_id`. Can include any extra fields |

**Returns:**

```javascript
// Private channel
{ auth: "appKey:hmac_signature" }

// Presence channel
{ auth: "appKey:hmac_signature", channel_data: "{\"user_id\":\"...\",...}" }

// Private channel with optional user_data
{ auth: "appKey:hmac_signature", user_data: "{...}" }
```

### Setting Up an Auth Endpoint

```javascript
import express from 'express';
import PingerchipsServer from 'pingerchips-js-server';

const app = express();
app.use(express.json());

const pingerchips = new PingerchipsServer(
  process.env.PINGERCHIPS_APP_KEY,
  process.env.PINGERCHIPS_APP_SECRET
);

app.post('/pingerchips/auth', (req, res) => {
  const { socket_id, channel_name, auth_info } = req.body;

  // 1. Verify the user from your own session/token system
  const user = verifyUser(auth_info.token);
  if (!user) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 2. Authorize access to this specific channel
  if (channel_name === `private-user-${user.id}`) {
    // user can access their own private channel
  } else if (channel_name.startsWith('private-')) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // 3. Build userData for presence channels
  let userData = null;
  if (channel_name.startsWith('presence-')) {
    userData = {
      user_id: user.id,
      user_info: {
        name: user.name,
        avatar: user.avatarUrl,
      },
    };
  }

  // 4. Generate the auth payload
  const authData = pingerchips.authenticate(socket_id, channel_name, userData);
  res.json(authData);
});

app.listen(3000);
```

The client SDK calls your auth endpoint automatically when subscribing to `private-*` or `presence-*` channels — you just need to set `authEndpoint` in the client constructor.

### Private Channel Auth (no userData)

```javascript
const authData = pingerchips.authenticate(socketId, 'private-chat-room');
// { auth: "appKey:signature" }
```

### Presence Channel Auth (userData required)

```javascript
const authData = pingerchips.authenticate(socketId, 'presence-lobby', {
  user_id: user.id,
  user_info: { name: user.name, status: 'online' },
});
// { auth: "appKey:signature", channel_data: "{\"user_id\":\"...\"}" }
```

:::note
`authenticate` throws if `channelName` does not start with `private-` or `presence-`, or if `userData` is missing `user_id` for presence channels.
:::

---

## mTLS Support

For deployments that require mutual TLS:

```javascript
const pingerchips = new PingerchipsServer(
  process.env.PINGERCHIPS_APP_KEY,
  process.env.PINGERCHIPS_APP_SECRET,
  {
    endpoint: 'https://queue.pingerchips.com',
    mtls: {
      enabled: true,
      cert: '/path/to/client-cert.pem',   // path or PEM string
      key:  '/path/to/client-key.pem',
      ca:   '/path/to/ca-cert.pem',
      rejectUnauthorized: true,
    },
  }
);
```

Pass PEM content directly instead of file paths if preferred:

```javascript
mtls: {
  enabled: true,
  cert: fs.readFileSync('/path/to/client-cert.pem', 'utf8'),
  key:  fs.readFileSync('/path/to/client-key.pem', 'utf8'),
  ca:   fs.readFileSync('/path/to/ca-cert.pem', 'utf8'),
}
```

---

## Error Handling

`trigger` throws on validation failures and non-2xx HTTP responses:

```javascript
try {
  await pingerchips.trigger('my-channel', 'my-event', { text: 'Hello' });
} catch (err) {
  console.error(err.message);
  // "channel must be a non-empty string"
  // "data payload must be 64KB or less"
  // "Failed to trigger event: 429 Too Many Requests - Rate limit exceeded"
  // "Request timeout after 10000ms"
}
```

The SDK retries 5xx responses and network errors up to `retries` times (default 2) before throwing.

---

## Python (`pingerchips`)

### Installation

```bash
pip install pingerchips
```

Requires Python ≥ 3.10. Dependencies: `httpx`.

### Initialization

```python
from pingerchips import PingerChips

pc = PingerChips(
    host="https://queue.pingerchips.com",
    app_id="YOUR_APP_KEY",
    app_secret="YOUR_APP_SECRET",
)
```

### Triggering Events

```python
# Public channel
pc.trigger("announcements", "new-post", {"title": "v2 Released", "url": "/blog/v2"})

# Private user channel
pc.trigger(f"private-user-{user_id}", "notification", {"type": "order-shipped"})

# Presence channel
pc.trigger("presence-game-room", "game-state", {"round": 3, "timeRemaining": 45})
```

#### `trigger_batch`

Trigger the same event on multiple channels in one request:

```python
pc.trigger_batch(["channel-a", "channel-b", "channel-c"], "update", {"value": 42})
```

### Authentication

Generate auth payloads for `private-*` or `presence-*` channel joins. Call from your auth endpoint.

```python
from flask import Flask, request, jsonify
from pingerchips import PingerChips

app = Flask(__name__)
pc = PingerChips(host="https://queue.pingerchips.com", app_id="APP_KEY", app_secret="APP_SECRET")

@app.post("/pingerchips/auth")
def pingerchips_auth():
    socket_id    = request.json["socket_id"]
    channel_name = request.json["channel_name"]

    user = verify_session(request.json.get("auth_info", {}).get("token"))
    if not user:
        return jsonify({"error": "Unauthorized"}), 403

    user_data = None
    if channel_name.startswith("presence-"):
        user_data = {"user_id": user.id, "user_info": {"name": user.name}}

    return jsonify(pc.channel_auth(socket_id, channel_name, user_data))
```

`channel_auth` returns:

```python
# Private channel
{"auth": "appKey:hmac_signature"}

# Presence channel
{"auth": "appKey:hmac_signature", "channel_data": "{\"user_id\":\"...\"}"}
```

### Push Notifications

```python
# Send push notification (only if user is offline)
pc.notify(user_id="user_123", title="New message", body="Alice said hello")

# Always deliver, even if user is connected
pc.notify(
    user_id="user_123",
    title="Alert",
    body="Action required",
    trigger="always",
    data={"url": "/alerts"},
)
```

#### Register / Unregister Device Tokens

```python
# Mobile (FCM or APNs)
pc.register_push_token(
    user_id="user_123",
    device_id="device_abc",
    platform="fcm",          # "fcm" or "apns"
    token="FCM_TOKEN",
)

# Web Push
pc.register_push_token(
    user_id="user_123",
    device_id="browser_xyz",
    platform="web",
    endpoint="https://fcm.googleapis.com/...",
    p256dh="...",
    auth="...",
)

pc.unregister_push_token(user_id="user_123", device_id="device_abc")
```

### Channel Config

Control durability, replay, and ordering behavior when creating or updating flows via the API.

```python
from pingerchips import channel_config, durable_channel_config, ephemeral_channel_config

# Custom config
cfg = channel_config(durable=True, replay=True, max_replay_messages=500, ordering="strict")

# Presets
durable   = durable_channel_config()    # WAL + ClickHouse, strict ordering
ephemeral = ephemeral_channel_config()  # no WAL, no replay, best-effort
```

### Chat REST API

```python
from pingerchips import PingerChipsChat

chat = PingerChipsChat(
    host="https://queue.pingerchips.com",
    app_key="YOUR_APP_KEY",
    app_secret="YOUR_APP_SECRET",
)

# Threads
thread = chat.create_thread(title="Support #42", created_by="user_1")
chat.join_thread(thread["id"], user_id="user_1", type="human", role="member")
chat.join_thread(thread["id"], bot_id="support-bot", type="bot")

# Messages
chat.send_message(thread["id"], user_id="user_1",
                  sender={"name": "Alice"}, content={"text": "Hello!"})
messages = chat.list_messages(thread["id"])
chat.edit_message(thread["id"], messages[0]["id"], content={"text": "Hello, updated"})
chat.delete_message(thread["id"], messages[0]["id"])

# Thread lifecycle
chat.resolve_thread(thread["id"])
chat.archive_thread(thread["id"])
chat.handoff_thread(thread["id"], assigned_agent="agent_99")
```

Use as a context manager to ensure the HTTP client is closed:

```python
with PingerChipsChat(host="...", app_key="...", app_secret="...") as chat:
    chat.send_message(thread_id, user_id="user_1", content={"text": "Hi"})
```

---

## Feature Comparison

| Feature | Node.js | Python |
|---|---|---|
| `trigger` | ✅ | ✅ |
| `trigger_batch` | ✅ | ✅ |
| Channel auth | ✅ | ✅ |
| Push notifications | ✅ | ✅ |
| Push token registration | ✅ | ✅ |
| mTLS | ✅ | — |
| Channel config builders | ✅ | ✅ |
| Chat REST API | ✅ | ✅ |
| Retry on 5xx | ✅ | ✅ |

---

## Next Steps

- [Client SDK](/docs/sdk/client-sdk) — receiving events in the browser or backend
- [Channel Types](/docs/sdk/channels) — public, private, presence
- [HMAC Signing](/docs/hmac-signing) — raw signing reference for non-SDK integrations
- [App Settings](/docs/app-settings) — rate limits, enable user authentication
