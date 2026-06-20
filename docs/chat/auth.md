---
sidebar_position: 6
---

# Authentication

Chat uses a per-thread HMAC token model. The App Secret never leaves your server.

---

## Flow overview

```
Client (browser)
   │
   │  1. "I want to join thread-xyz"
   ▼
Your Server
   │
   │  2. POST /api/chat/auth  (X-App-Key + X-App-Secret)
   ▼
Pingerchips
   │
   │  3. { auth: "appKey:hmac_signature" }
   ▼
Your Server
   │
   │  4. Forward auth to client
   ▼
Client (browser)
   │
   │  5. WebSocket join with auth token
   ▼
Pingerchips (verifies signature, allows join)
```

---

## Step 2: Call the auth endpoint

Your server issues the token on behalf of a client. It must include the app credentials as headers.

```http
POST /api/chat/auth
X-App-Key: pk_live_...
X-App-Secret: sk_live_...
Content-Type: application/json

{
  "socket_id": "abc123.def456",
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "client_id": "user-42"
}
```

**Response:**

```json
{
  "auth": "pk_live_...:a3f2b9c1d4e5f6..."
}
```

---

## What is signed

The HMAC-SHA256 signature covers:

```
{socketId}:chat:v1:app:{appKey}:thread:{threadId}:{clientId}
```

This binds the token to:
- The specific WebSocket connection (`socket_id`)
- The specific app (`appKey`)
- The specific thread (`thread_id`)
- The specific client (`client_id`)

A token issued for thread A cannot be used to join thread B. A token issued for socket S cannot be replayed on a different socket.

---

## Server-side examples

### Node.js (Express)

```js
import express from 'express';

const app = express();
app.use(express.json());

app.post('/chat/auth', async (req, res) => {
  const { socket_id, thread_id, client_id } = req.body;

  // Verify the requesting user is allowed to join this thread
  if (!await canUserAccessThread(req.user, thread_id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const response = await fetch(`${process.env.PINGER_HOST}/api/chat/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Key':    process.env.PINGER_KEY,
      'X-App-Secret': process.env.PINGER_SECRET,
    },
    body: JSON.stringify({ socket_id, thread_id, client_id }),
  });

  const data = await response.json();
  res.json(data);
});
```

### Elixir / Phoenix

```elixir
defmodule MyAppWeb.ChatAuthController do
  use MyAppWeb, :controller

  def create(conn, %{"socket_id" => socket_id, "thread_id" => thread_id, "client_id" => client_id}) do
    user = conn.assigns.current_user

    with :ok <- MyApp.Chat.authorize_thread(user, thread_id) do
      {:ok, %{status: 200, body: body}} =
        HTTPoison.post(
          "#{pinger_host()}/api/chat/auth",
          Jason.encode!(%{socket_id: socket_id, thread_id: thread_id, client_id: client_id}),
          [
            {"Content-Type", "application/json"},
            {"X-App-Key", pinger_key()},
            {"X-App-Secret", pinger_secret()},
          ]
        )

      json(conn, Jason.decode!(body))
    else
      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "Forbidden"})
    end
  end
end
```

---

## Client-side configuration

Pass your auth endpoint as the `authenticateChat` callback:

```js
const chat = new PingerchipsChat({
  appKey: 'pk_live_...',
  host:   'wss://your-host',

  authenticateChat: async ({ socketId, threadId, clientId }) => {
    const res = await fetch('/chat/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        socket_id: socketId,
        thread_id: threadId,
        client_id: clientId,
      }),
    });
    if (!res.ok) throw new Error('Auth failed');
    const { auth } = await res.json();
    return auth;
  },
});
```

The SDK calls `authenticateChat` automatically when `joinThread` is called.

---

## Agent authentication

Agents authenticate differently — they use the App Secret directly to sign their own join token, without calling the HTTP auth endpoint. This is handled automatically by `AgentSession` when you pass `appSecret`.

The agent's `client_id` defaults to `"agent:{agentId}"` and is excluded from the standard per-user authorization check on the auth endpoint.

---

## Security notes

- The App Secret must **never** be sent to or stored in the browser
- `authenticateChat` should verify that the requesting user is allowed to access the given `thread_id` before calling the Pingerchips endpoint
- Tokens are single-use per socket connection — reconnects trigger a fresh `authenticateChat` call
- The `client_id` is passed through to messages as `owner_client_id` and is visible to all thread participants
