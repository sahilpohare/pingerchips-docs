---
sidebar_position: 3
---

# App Settings

Every Pingerchips app has a set of configuration options you can manage from the dashboard at **Dashboard → Apps → [Your App]**.

## Credentials

| Field | Description |
|-------|-------------|
| **App ID** | Internal identifier. Used in server SDK calls and channel topics |
| **App Key** | Public key. Clients connect with this. Safe to expose in frontend code |
| **App Secret** | Private key. Used to sign server requests and authenticate channels. **Never expose in client code** |

Keep your App Secret in environment variables:

```bash
PINGERCHIPS_APP_ID=your-app-id
PINGERCHIPS_APP_KEY=your-app-key
PINGERCHIPS_APP_SECRET=your-app-secret
```

---

## Toggles

### Active

Enables or disables the entire app.

- **On** — clients can connect and events flow normally.
- **Off** — all new connection attempts are rejected. Existing connections are dropped.

Use this to take an app offline for maintenance without deleting it.

---

### Enable Client Messages

Controls whether **clients can send events to other clients** through Pingerchips (client-triggered events).

- **On** — a client can call `channel.trigger('event', data)` and the event is processed by the flow and broadcast to other subscribers.
- **Off** — `channel.trigger(...)` calls are rejected with `{reason: "Client messages are disabled for this app"}`.

:::warning
Disable client messages if your app only needs server → client broadcasts and you don't want clients sending arbitrary events.
:::

---

### Enable User Authentication

Controls whether **private and presence channels require authentication**.

- **Off (default)** — any client can join any channel, including `private-` and `presence-` prefixed ones, without an auth signature.
- **On** — clients joining `private-*` or `presence-*` channels must provide a valid HMAC auth signature. Public channels are unaffected.

When enabled, configure an auth endpoint in your client SDK:

```javascript
const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://pinger-processor.pingerchips.com/socket',
  authEndpoint: 'https://your-server.com/pingerchips/auth',
  authInfo: { token: userSessionToken }
});
```

See [Server SDK Authentication](/docs/sdk/server-sdk#authentication) for how to implement the auth endpoint.

---

## Rate Limits

Rate limits are configured per-app and enforced server-side. They protect your app and other tenants from traffic spikes.

| Setting | Default | Description |
|---------|---------|-------------|
| **Max Connections** | Unlimited (`-1`) | Maximum simultaneous WebSocket connections |
| **Max Backend Events/sec** | 1000 | Events per second via the HTTP trigger API |
| **Max Client Events/sec** | 1000 | Events per second from WebSocket clients |
| **Max Read Requests/sec** | Unlimited (`-1`) | HTTP read requests per second |

When a limit is exceeded the server returns HTTP `429 Too Many Requests` or a WebSocket error `{reason: "Rate limit exceeded"}`.

:::note
`-1` means unlimited. Contact support to raise limits on paid plans.
:::

---

## Message Constraints

Enforce size and naming constraints on events flowing through your app.

| Setting | Default | Description |
|---------|---------|-------------|
| **Max Event Payload** | Unlimited | Maximum JSON payload size in KB |
| **Max Event Name Length** | Unlimited | Maximum character length of event names |
| **Max Channel Name Length** | Unlimited | Maximum character length of channel names |
| **Max Event Batch Size** | Unlimited | Maximum events per batch trigger request |
| **Max Event Channels at Once** | Unlimited | Max channels a single event can target |

When a constraint is violated the request is rejected with HTTP `422 Unprocessable Entity` and an error message describing which limit was exceeded.

---

## Presence Settings

| Setting | Description |
|---------|-------------|
| **Max Presence Members/Channel** | Maximum subscribers tracked in a presence channel |
| **Max Presence Member Size** | Maximum size of a presence member's data (in KB) |

---

## Webhooks

Configure HTTP endpoints to receive notifications when events occur on your app. Each webhook entry specifies:

- **URL** — your server endpoint
- **Events** — which event types trigger the webhook

Webhook payloads are delivered as `POST` requests with a JSON body.

---

## Next Steps

- [Channel Types](/docs/sdk/channels) — public, private, presence
- [Pingerflows](/docs/tutorial-basics/getting-started) — process events before delivery
- [Analytics](/docs/analytics) — monitor your app metrics
