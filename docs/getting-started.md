---
sidebar_position: 1
---

# Getting Started

Get up and running with Pingerchips in minutes.

## What is Pingerchips?

Pingerchips is real-time WebSocket infrastructure for developers. Send events between your servers and clients with sub-10ms latency. It is built on Phoenix Channels.

Key capabilities:

- **Public, private, and presence channels** — from open broadcasts to authenticated per-user streams
- **Pingerflows** — a visual pipeline to filter, transform, throttle, validate, and reroute messages before delivery
- **Server and client SDKs** — trigger events from your backend or directly between clients
- **Free during beta** — no credit card required

---

## 1. Create an App

1. Sign up or log in at [dashboard.pingerchips.com](https://dashboard.pingerchips.com)
2. Go to **Dashboard → Apps → New App**
3. Give it a name and click **Create**

You will see three credentials on the app settings page:

| Credential | Use |
|------------|-----|
| **App ID** | Internal identifier |
| **App Key** | Public — pass to the client SDK to connect, and used in server SDK calls |
| **App Secret** | Private — signs server requests and auth tokens. Never expose in frontend code |

Store them as environment variables:

```bash
PINGERCHIPS_APP_KEY=your-app-key
PINGERCHIPS_APP_SECRET=your-app-secret
```

---

## 2. Install the SDKs

**Client (frontend):**

```bash
npm install pingerchips-js
```

**Server (backend):**

```bash
npm install pingerchips-js-server
```

Both packages require **ESM** (`"type": "module"` in package.json, or use `.mjs` extension).

---

## 3. Send Your First Event

**Backend — trigger an event from your server:**

```javascript
import PingerchipsServer from 'pingerchips-js-server';

const pingerchips = new PingerchipsServer(
  process.env.PINGERCHIPS_APP_KEY,
  process.env.PINGERCHIPS_APP_SECRET,
  {
    endpoint: 'https://queue.pingerchips.com',
  }
);

await pingerchips.trigger('my-channel', 'my-event', {
  message: 'Hello from Pingerchips!',
});
```

**Frontend — subscribe and receive:**

```javascript
import Pingerchips from 'pingerchips-js';

const client = new Pingerchips(process.env.PINGERCHIPS_APP_KEY, {
  endpoint: 'wss://queue.pingerchips.com/socket',
});

const channel = await client.subscribe('my-channel');

channel.bind('my-event', (data) => {
  console.log('Received:', data);
});
```

---

## 4. Complete Chat Example

**Server (Express.js):**

```javascript
import express from 'express';
import PingerchipsServer from 'pingerchips-js-server';

const app = express();
app.use(express.json());

const pingerchips = new PingerchipsServer(
  process.env.PINGERCHIPS_APP_KEY,
  process.env.PINGERCHIPS_APP_SECRET,
  { endpoint: 'https://queue.pingerchips.com' }
);

app.post('/api/send-message', async (req, res) => {
  const { channel, message } = req.body;
  await pingerchips.trigger(channel, 'new-message', {
    text: message,
    timestamp: Date.now(),
  });
  res.json({ success: true });
});

app.listen(3000);
```

**Client (React):**

```jsx
import { useEffect, useRef, useState } from 'react';
import Pingerchips from 'pingerchips-js';

export function ChatApp() {
  const [messages, setMessages] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    const client = new Pingerchips(process.env.NEXT_PUBLIC_PINGERCHIPS_APP_KEY, {
      endpoint: 'wss://queue.pingerchips.com/socket',
    });

    client.subscribe('chat').then((ch) => {
      channelRef.current = ch;
      ch.bind('new-message', (data) => {
        setMessages((prev) => [...prev, data]);
      });
    });

    return () => channelRef.current?.leave();
  }, []);

  const sendMessage = async (text) => {
    await fetch('/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'chat', message: text }),
    });
  };

  return (
    <div>
      {messages.map((msg, i) => <div key={i}>{msg.text}</div>)}
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

---

## Next Steps

- **[Client SDK](/docs/sdk/client-sdk)** — full client API reference
- **[Server SDK](/docs/sdk/server-sdk)** — triggering events, authentication
- **[Channel Types](/docs/sdk/channels)** — public, private, and presence channels
- **[App Settings](/docs/app-settings)** — rate limits, toggles, credentials
- **[Pingerflows](/docs/tutorial-basics/getting-started)** — filter, transform, and route events with a visual pipeline
