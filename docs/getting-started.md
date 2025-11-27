---
sidebar_position: 1
---

# Getting Started

Let's discover **Pingerchips in less than 5 minutes**.

## What is Pingerchips?

Pingerchips is a real-time messaging service that allows you to send events to your users instantly. It's compatible with Pusher, making it easy to integrate into existing applications.

## Features

- **Real-time messaging** - Send events to your users with ultra-low latency
- **Multiple channel types** - Public, private, and presence channels
- **Pusher compatible** - Works with existing Pusher client libraries
- **Pingerflows** - Transform and filter events before delivery
- **Easy integration** - Simple SDKs for JavaScript/Node.js
- **Scalable** - Built on Phoenix and Elixir for high performance

## Create Your App

1. Log into your [Pingerchips Dashboard](https://dashboard.pingerchips.com/dashboard/apps)
2. Create a new app
3. You will receive:
   - **App ID** - Your application identifier
   - **App Key** - Public key for client connections
   - **App Secret** - Secret key for server operations (keep this secure!)

:::note
You cannot have the same `APP NAME` in one account.
:::

## Quick Start

### 1. Install the SDKs

**Client SDK (for your frontend):**

```bash
npm install pingerchips-js
```

**Server SDK (for your backend):**

```bash
npm install pingerchips-js-server
```

### 2. Send Your First Event

**Backend (Node.js):**

```javascript
import PingerchipsServer from 'pingerchips-js-server';

const pingerchips = new PingerchipsServer('YOUR_APP_ID', 'YOUR_APP_SECRET', {
  appKey: 'YOUR_APP_KEY',
  endpoint: 'https://pinger-processor.pingerchips.com/api',
  token: 'YOUR_API_TOKEN'
});

// Trigger an event
await pingerchips.trigger('my-channel', 'my-event', {
  message: 'Hello from Pingerchips!'
});
```

**Frontend (JavaScript):**

```javascript
import Pingerchips from 'pingerchips-js';

// Connect to Pingerchips
const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://pinger-processor.pingerchips.com/socket'
});

// Subscribe to a channel
const channel = await client.subscribe('my-channel');

// Listen for events
channel.bind('my-event', (data) => {
  console.log('Received:', data);
  alert('Message: ' + data.message);
});
```

That's it! You've sent and received your first real-time event with Pingerchips. 🎉

## Complete Example

Here's a complete example of a simple chat application:

**Server (Express.js):**

```javascript
import express from 'express';
import PingerchipsServer from 'pingerchips-js-server';

const app = express();
app.use(express.json());

const pingerchips = new PingerchipsServer(
  process.env.PINGERCHIPS_APP_ID,
  process.env.PINGERCHIPS_APP_SECRET,
  {
    appKey: process.env.PINGERCHIPS_APP_KEY,
    endpoint: 'https://pinger-processor.pingerchips.com/api',
    token: process.env.PINGERCHIPS_API_TOKEN
  }
);

app.post('/api/send-message', async (req, res) => {
  const { channel, message } = req.body;

  await pingerchips.trigger(channel, 'new-message', {
    text: message,
    timestamp: Date.now()
  });

  res.json({ success: true });
});

app.listen(3000);
```

**Client (React):**

```jsx
import { useEffect, useState } from 'react';
import Pingerchips from 'pingerchips-js';

function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [client, setClient] = useState(null);
  const [channel, setChannel] = useState(null);

  useEffect(() => {
    // Initialize Pingerchips
    const pingerchips = new Pingerchips('YOUR_APP_KEY', {
      endpoint: 'wss://pinger-processor.pingerchips.com/socket'
    });

    setClient(pingerchips);

    // Subscribe to chat channel
    pingerchips.subscribe('chat').then(ch => {
      setChannel(ch);

      // Listen for new messages
      ch.bind('new-message', (data) => {
        setMessages(prev => [...prev, data]);
      });
    });

    return () => {
      if (channel) channel.leave();
    };
  }, []);

  const sendMessage = async (text) => {
    // Send to your backend
    await fetch('/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'chat', message: text })
    });
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i}>{msg.text}</div>
        ))}
      </div>
      <button onClick={() => sendMessage('Hello!')}>
        Send Message
      </button>
    </div>
  );
}
```

## Using Pusher SDKs (Alternative)

Pingerchips is compatible with Pusher, so you can use any Pusher client library:

**Server (with Pusher Node.js SDK):**

```javascript
const Pusher = require('pusher');

const pusher = new Pusher({
  appId: 'YOUR_APP_ID',
  key: 'YOUR_APP_KEY',
  secret: 'YOUR_APP_SECRET',
  host: 'pinger-processor.pingerchips.com',
  port: 443,
  useTLS: true
});

await pusher.trigger('my-channel', 'my-event', {
  message: 'Hello World'
});
```

**Client (with Pusher JS):**

```javascript
import Pusher from 'pusher-js';

const pusher = new Pusher('YOUR_APP_KEY', {
  wsHost: 'pinger-processor.pingerchips.com',
  wsPort: 443,
  forceTLS: true,
  encrypted: true,
  disableStats: true,
  enabledTransports: ['ws', 'wss']
});

const channel = pusher.subscribe('my-channel');
channel.bind('my-event', (data) => {
  alert('Message: ' + data.message);
});
```

## Next Steps

Now that you've sent your first event, explore these topics:

- **[Client SDK](/docs/sdk/client-sdk)** - Learn all client SDK features
- **[Server SDK](/docs/sdk/server-sdk)** - Master server-side event triggering
- **[Channel Types](/docs/sdk/channels)** - Understand public, private, and presence channels
- **[Pingerflows](/docs/tutorial-basics/getting-started)** - Transform and filter events with flows

## Need Help?

- Check our [documentation](/docs/getting-started)
- Visit the [Pingerchips Dashboard](https://dashboard.pingerchips.com)
- Review [API examples](/docs/sdk/client-sdk)

Happy building! 🚀
