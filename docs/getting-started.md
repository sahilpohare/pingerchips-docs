---
sidebar_position: 1
---

# Getting Started

Get up and running with Pingerchips in minutes.

## What is Pingerchips?

Pingerchips is real-time infrastructure for AI applications. It gives your agents and users a shared, live connection — so LLM streams reach the browser instantly, agent state is visible as it changes, and multiple agents can coordinate without polling.

**Core primitives:**

| Primitive | What it does |
|---|---|
| **Channels** | Fast pub/sub — public, private, and presence |
| **Durable Objects** | Named, persistent key-value entities with real-time subscriptions |
| **Chat / Sessions** | Durable threads with LLM token streaming and message history |
| **Spaces** | Ephemeral presence — cursors, members, locations, and locks |
| **Pingerflows** | Visual pipeline to filter, transform, throttle, and route events |

---

## 1. Create an App

1. Sign up or log in at [dashboard.pingerchips.com](https://dashboard.pingerchips.com)
2. Go to **Dashboard → Apps → New App**
3. Give it a name and click **Create**

You will see three credentials on the app settings page:

| Credential | Use |
|---|---|
| **App ID** | Internal identifier |
| **App Key** | Public — pass to the client SDK to connect |
| **App Secret** | Private — signs server requests and auth tokens. Never expose in frontend code |

Store them as environment variables:

```bash
PINGERCHIPS_APP_KEY=your-app-key
PINGERCHIPS_APP_SECRET=your-app-secret
```

---

## 2. Install the SDK

```bash
npm install pingerchips-js
```

Requires **ESM** (`"type": "module"` in package.json, or `.mjs` extension).

---

## 3. Choose your primitive

### Channels — fast pub/sub

Send events between your server and clients. Use this when you don't need persistence.

**Server:**

```js
import PingerchipsServer from 'pingerchips-js/server';

const pc = new PingerchipsServer(
  process.env.PINGERCHIPS_APP_KEY,
  process.env.PINGERCHIPS_APP_SECRET
);

await pc.trigger('my-channel', 'my-event', { message: 'Hello!' });
```

**Client:**

```js
import Pingerchips from 'pingerchips-js';

const client = new Pingerchips(process.env.PINGERCHIPS_APP_KEY);
const channel = await client.subscribe('my-channel');

channel.bind('my-event', (data) => {
  console.log('Received:', data);
});
```

---

### Durable Objects — persistent agent state

Named objects with slots, atomic operations, and real-time subscriptions. Every write is logged and streamed to all subscribers. Use this for agent run state, shared working memory, and approval queues.

**Server — write state:**

```js
import PingerchipsServer from 'pingerchips-js/server';

const pc = new PingerchipsServer(
  process.env.PINGERCHIPS_APP_KEY,
  process.env.PINGERCHIPS_APP_SECRET
);

const run = pc.object('run', 'run-abc123');

await run.set('status', 'processing');
await run.set('model', 'claude-opus-4-6');
await run.append('steps', { tool: 'web_search', at: Date.now() });
await run.increment('token_count', 512);
```

**Client — subscribe to changes:**

```js
import Pingerchips from 'pingerchips-js';

const pc = new Pingerchips('pk_live_...', {
  authEndpoint: '/auth/durable',
});

const run = await pc.object('run', 'run-abc123');

console.log(run.state);
// { status: "processing", model: "claude-opus-4-6", token_count: 512, steps: [...] }

run.on('change:status', ({ value }) => {
  updateStatusBadge(value);
});
```

See the [Durable Objects quickstart](/docs/durable-objects/cookbook/quickstart) for auth setup and transactions.

---

### Chat / Sessions — LLM streaming with persistence

Durable threads where agents stream tokens and messages are stored. Use this for AI chat interfaces, copilots, and multi-agent pipelines that need an audit log.

**Client — connect and receive:**

```js
import { PingerchipsChat } from 'pingerchips-js/chat';

const chat = new PingerchipsChat({
  appKey: 'pk_live_...',
  host: 'wss://your-pingerchips-host',
  authenticateChat: async ({ socketId, threadId, clientId }) => {
    const res = await fetch('/chat/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socket_id: socketId, thread_id: threadId, client_id: clientId }),
    });
    const { auth } = await res.json();
    return auth;
  },
});

await chat.connect();

const session = await chat.joinThread('thread-uuid', { clientId: 'user-123' });

session.onToken((runId, token) => process.stdout.write(token));
session.onMessage((msg) => console.log('Done:', msg.content.text));

await session.send('Hello!');
```

**Agent — stream a response:**

```js
import { AgentSession } from 'pingerchips-js/chat';
import Anthropic from '@anthropic-ai/sdk';

const agent = new AgentSession({
  appKey: 'pk_live_...',
  appSecret: process.env.PINGERCHIPS_SECRET,
  host: 'wss://your-pingerchips-host',
  threadId: 'thread-uuid',
  agentId: 'my-bot',
});

await agent.connect();

agent.onMessage(async (msg) => {
  if (msg.role !== 'user') return;

  const run = await agent.startRun();
  const stream = new Anthropic().messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: msg.content.text }],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') {
      await run.pushToken(chunk.delta.text);
    }
  }

  const final = await stream.finalMessage();
  await run.end({ content: final.content[0].text });
});
```

See the [Chat quickstart](/docs/chat/cookbook/quickstart) for the full auth flow and history loading.

---

### Spaces — ephemeral presence

Show who's online, share cursors, and coordinate locks. State is fully ephemeral — disconnecting cleans everything up automatically.

```js
import { PingerchipsSpaces } from 'pingerchips-js/spaces';

const spaces = new PingerchipsSpaces('pk_live_...');
const space = await spaces.get('doc-abc123');

await space.enter({ name: 'Alice' });

space.members.subscribe((members) => {
  console.log('Online:', members.map((m) => m.profileData.name));
});

space.cursors.set({ x: 124, y: 88 });
space.cursors.subscribe((updates) => {
  renderCursors(updates);
});
```

See the [Spaces quickstart](/docs/spaces/cookbook/quickstart).

---

## Next Steps

- **[Channels](/docs/sdk/channels)** — public, private, and presence channel types
- **[Durable Objects](/docs/durable-objects/intro)** — persistent state for agents
- **[Chat / Sessions](/docs/chat/intro)** — LLM streaming and conversation threads
- **[Spaces](/docs/spaces/intro)** — real-time presence and cursors
- **[Pingerflows](/docs/tutorial-basics/getting-started)** — filter, transform, and route events visually
- **[App Settings](/docs/app-settings)** — rate limits, credentials, toggles
