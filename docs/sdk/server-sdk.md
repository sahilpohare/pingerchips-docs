---
sidebar_position: 2
---

# Server SDK (Node.js)

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

## Next Steps

- [Client SDK](/docs/sdk/client-sdk) — receiving events in the browser
- [Channel Types](/docs/sdk/channels) — public, private, presence
- [HMAC Signing](/docs/hmac-signing) — raw signing reference for non-SDK integrations
- [App Settings](/docs/app-settings) — rate limits, enable user authentication
