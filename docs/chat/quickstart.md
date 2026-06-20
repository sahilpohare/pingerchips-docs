---
sidebar_position: 3
---

# Quickstart

Build a working AI chat interface in under 15 minutes.

---

## Prerequisites

- A Pingerchips app with `App Key` and `App Secret`
- Node.js 18+
- An LLM provider (OpenAI, Anthropic, etc.)

---

## 1. Install the SDK

```bash
npm install pingerchips-js
```

---

## 2. Issue a chat auth token (server)

Your backend issues a short-lived HMAC token for each client. **Never expose your App Secret to the browser.**

```js
// server.js (Express example)
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const APP_KEY    = process.env.PINGERCHIPS_KEY;
const APP_SECRET = process.env.PINGERCHIPS_SECRET;
const PINGER_URL = 'https://your-pingerchips-host';

app.post('/chat/auth', async (req, res) => {
  const { socket_id, thread_id, client_id } = req.body;

  // Call the Pingerchips auth endpoint
  const response = await fetch(`${PINGER_URL}/api/chat/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Key':    APP_KEY,
      'X-App-Secret': APP_SECRET,
    },
    body: JSON.stringify({ socket_id, thread_id, client_id }),
  });

  const { auth } = await response.json();
  res.json({ auth });
});

app.listen(3000);
```

---

## 3. Connect on the client

```js
import { PingerchipsChat } from 'pingerchips-js/chat';

const chat = new PingerchipsChat({
  appKey:       'pk_live_...',
  host:         'wss://your-pingerchips-host',
  authenticateChat: async ({ socketId, threadId, clientId }) => {
    const res = await fetch('/chat/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        socket_id: socketId,
        thread_id: threadId,
        client_id: clientId,
      }),
    });
    const { auth } = await res.json();
    return auth;
  },
});

await chat.connect();
```

---

## 4. Join a thread and send a message

```js
const session = await chat.joinThread('thread-uuid-here', {
  clientId: 'user-123',
});

// Listen for incoming messages
session.onMessage((msg) => {
  if (msg.role === 'assistant') {
    console.log('Agent:', msg.content.text);
  }
});

// Listen for streaming tokens
session.onToken((runId, content) => {
  process.stdout.write(content);
});

// Send a user message
await session.send('Hello! What can you help me with?');
```

---

## 5. Build the agent side

Your agent connects to the same thread and streams its response.

```js
import { AgentSession } from 'pingerchips-js/chat';
import Anthropic from '@anthropic-ai/sdk';

const agent = new AgentSession({
  appKey:    'pk_live_...',
  appSecret: process.env.PINGERCHIPS_SECRET,
  host:      'wss://your-pingerchips-host',
  threadId:  'thread-uuid-here',
  agentId:   'my-bot',
});

await agent.connect();

agent.onMessage(async (msg) => {
  if (msg.role !== 'user') return;

  const run = await agent.startRun();
  const client = new Anthropic();

  const stream = client.messages.stream({
    model:      'claude-opus-4-6',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: msg.content.text }],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') {
      await run.pushToken(chunk.delta.text);
    }
  }

  const message = await stream.finalMessage();
  await run.end({ content: message.content[0].text });
});
```

---

## 6. Load history

```js
// Load the last 50 messages on mount
const history = await session.getHistory();

// Paginate backwards
if (history.has_older) {
  const older = await session.loadOlder(history.messages[0].id);
}
```

---

## What's next

- [Core Concepts](./concepts) — threads, runs, conversation trees, archival
- [Client SDK](./client-sdk) — full API reference for `PingerchipsChat` and `ChatSession`
- [Agent SDK](./agent-sdk) — full API reference for `AgentSession` and `Run`
- [Auth](./auth) — HMAC token flow in detail
- [Architecture](./architecture) — WAL, `set_volatile`, GC, archival internals
