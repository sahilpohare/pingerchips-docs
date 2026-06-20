---
sidebar_position: 7
---

# Authentication

Durable Objects use two auth models depending on the caller:

| Caller | Auth model |
|---|---|
| Server SDK / HTTP API | HMAC with App Key + App Secret |
| Client SDK (browser) | Per-object HMAC token, issued by your server |

---

## Server auth (App Secret)

Server-side calls are authenticated by signing each request with your App Secret. The server SDK handles this automatically.

The HTTP API uses three headers:

```http
X-App-Key:    pk_live_...
X-Signature:  {hmac_sha256_of_request}
X-Timestamp:  {unix_seconds}
```

The signature covers: `{timestamp}:{METHOD}:{path}:{sha256_body_hash}`.

Requests with a timestamp more than 5 minutes old are rejected to prevent replay attacks.

---

## Client auth (per-object token)

Browser clients must not have access to the App Secret. Instead, your server issues a short-lived HMAC token for each object the client wants to subscribe to.

### Flow

```
Client (browser)
   │
   │  1. "I want to subscribe to order/order-42"
   ▼
Your Server
   │
   │  2. Verify user can read order-42
   │  3. pc.authenticateObject(socketId, "order", "order-42")
   ▼
Your Server
   │
   │  4. { auth: "appKey:hmac_signature" }
   ▼
Client (browser)
   │
   │  5. pc.object("order", "order-42") — joins channel with auth token
   ▼
Pingerchips (verifies token, allows subscribe)
```

### Server: issue the token

```js
// Express auth endpoint
app.post('/auth/durable', (req, res) => {
  const { socket_id, object_type, object_key } = req.body;

  // Your authorisation logic
  const user = req.user;
  if (!canUserRead(user, object_type, object_key)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(pc.authenticateObject(socket_id, object_type, object_key));
});
```

`authenticateObject` returns `{ auth: "pk_live_...:hmac_signature" }`.

### What is signed

```
{socketId}:durable:v1:app:{appKey}:{objectType}:{objectKey}
```

The token is bound to the specific socket connection, app, object type, and object key. A token for `order/order-42` cannot be used to subscribe to `order/order-99`.

### Client: configure the auth endpoint

```js
const pc = new Pingerchips('pk_live_...', {
  authEndpoint: '/auth/durable',
});
```

The SDK calls your auth endpoint automatically when `pc.object(type, key)` is called, passing `socket_id`, `object_type`, and `object_key` in the request body.

### Custom auth request

If you need to pass additional context (e.g. user session token):

```js
const pc = new Pingerchips('pk_live_...', {
  authHandler: async ({ socketId, objectType, objectKey }) => {
    const res = await fetch('/auth/durable', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        socket_id:   socketId,
        object_type: objectType,
        object_key:  objectKey,
      }),
    });
    const { auth } = await res.json();
    return auth;
  },
});
```

---

## Security notes

- The App Secret must **never** be sent to or stored in the browser
- Issue separate tokens per object — a token for one object does not grant access to another
- Implement authorisation in your auth endpoint: verify the requesting user is allowed to read the requested object type and key
- Tokens are single-use per socket connection. On reconnect, the SDK automatically requests a fresh token
