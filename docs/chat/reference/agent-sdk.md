---
sidebar_position: 5
---

# Agent SDK

The agent-side API for LLM processes that read from and write to a thread.

```js
import { AgentSession, Run } from 'pingerchips-js/chat';
```

Agents connect to the same thread channel as clients, but authenticate with the app secret rather than an HMAC user token.

---

## AgentSession

### Constructor

```ts
new AgentSession(options: AgentOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `appKey` | string | yes | Your Pingerchips App Key |
| `appSecret` | string | yes | Your App Secret (server-side only) |
| `host` | string | yes | WebSocket host |
| `threadId` | string | yes | Thread to join |
| `agentId` | string | yes | Identifier for this agent (shown to clients) |
| `clientId` | string | no | Defaults to `"agent:{agentId}"` |

### `connect(): Promise<void>`

Authenticates and joins the thread channel.

```js
const agent = new AgentSession({ ... });
await agent.connect();
```

### `startRun(options?): Promise<Run>`

Announces `run:start` to the thread and returns a `Run` handle.

```ts
startRun(options?: {
  runId?: string;       // auto-generated UUID if omitted
  parentId?: string;    // message this run replies to
}) => Promise<Run>
```

```js
const run = await agent.startRun({ parentId: userMessage.id });
```

### `onMessage(handler): () => void`

Fires when a new message arrives in the thread.

```js
agent.onMessage(async (message: Message) => {
  if (message.role !== 'user') return;
  const run = await agent.startRun({ parentId: message.id });
  // ... generate and stream
});
```

### `onRegenerate(handler): () => void`

Fires when a client requests regeneration of an assistant message.

```js
agent.onRegenerate(async ({ messageId, forkMessageId }) => {
  // messageId   = original message to regenerate
  // forkMessageId = new message id already created server-side for the fork
  const run = await agent.startRun({ parentId: forkMessageId });
  // ... generate and stream
});
```

### `onCancel(handler): () => void`

Fires when a client cancels a run.

```js
agent.onCancel((runId: string) => {
  // Abort your LLM call
  myAbortController.abort();
});
```

### `disconnect(): void`

Leaves the thread channel.

---

## Run

Obtained from `agent.startRun()`. Manages the lifecycle of one LLM generation.

### `pushToken(content: string): Promise<void>`

Sends the current accumulated content to the token buffer. The buffer flushes to subscribers every ~40 ms.

```js
let accumulated = '';
for await (const chunk of stream) {
  accumulated += chunk.delta.text;
  await run.pushToken(accumulated);
}
```

Note: pass the **full accumulated string**, not just the delta. This matches how `onToken` delivers content to clients (always the full current content, not a delta).

### `end(options): Promise<Message>`

Flushes the token buffer, commits the final message to the WAL and Postgres, announces `run:end` to subscribers.

```ts
end(options: {
  content: string;
  metadata?: object;
}) => Promise<Message>
```

```js
const message = await run.end({ content: finalText });
```

### `suspend(toolCalls): Promise<void>`

Suspends the run pending tool approval. Broadcasts `run:suspend` with the pending tool calls.

```ts
suspend(toolCalls: ToolCall[]) => Promise<void>
```

```js
await run.suspend([
  { id: 'call-1', name: 'get_weather', arguments: { city: 'London' } }
]);
```

The run waits until a client pushes `tool_approval` or the run is cancelled.

### `resume(toolResults): Promise<void>`

Called after receiving tool results from a client. Resumes the run and broadcasts `run:resume`.

```ts
resume(toolResults: ToolResult[]) => Promise<void>
```

```js
agent.onToolApproval(async ({ runId, results }) => {
  await run.resume(results);
  // continue generating
});
```

### `cancel(): Promise<void>`

Cancels the run. Broadcasts `run:end` with `status: "cancelled"`.

---

## Full streaming example

```js
import { AgentSession } from 'pingerchips-js/chat';
import Anthropic from '@anthropic-ai/sdk';

const agent = new AgentSession({
  appKey:    process.env.PINGER_KEY,
  appSecret: process.env.PINGER_SECRET,
  host:      'wss://your-host',
  threadId:  threadId,
  agentId:   'claude-assistant',
});

await agent.connect();

const anthropic = new Anthropic();

agent.onMessage(async (message) => {
  if (message.role !== 'user') return;

  const run = await agent.startRun({ parentId: message.id });
  let accumulated = '';

  try {
    const stream = anthropic.messages.stream({
      model:      'claude-opus-4-6',
      max_tokens: 2048,
      messages:   buildHistory(message),
    });

    stream.on('text', async (delta) => {
      accumulated += delta;
      await run.pushToken(accumulated);
    });

    await stream.finalMessage();
    await run.end({ content: accumulated });

  } catch (err) {
    await run.cancel();
    throw err;
  }
});
```

---

## Tool use with suspension

```js
agent.onMessage(async (message) => {
  if (message.role !== 'user') return;

  const run = await agent.startRun({ parentId: message.id });
  const client = new Anthropic();

  // First generation pass — may produce tool calls
  const response = await client.messages.create({
    model:   'claude-opus-4-6',
    max_tokens: 1024,
    tools:   MY_TOOLS,
    messages: buildHistory(message),
  });

  if (response.stop_reason === 'tool_use') {
    const toolCalls = response.content
      .filter(b => b.type === 'tool_use')
      .map(b => ({ id: b.id, name: b.name, arguments: b.input }));

    await run.suspend(toolCalls);

    // Wait for tool_approval from client
    const results = await new Promise((resolve) => {
      agent.onToolApproval(({ results }) => resolve(results));
    });

    await run.resume(results);

    // Second pass with tool results
    const finalResponse = await client.messages.create({
      model:    'claude-opus-4-6',
      max_tokens: 1024,
      messages: [...buildHistory(message), ...buildToolResults(response, results)],
    });

    await run.end({ content: finalResponse.content[0].text });
  } else {
    await run.end({ content: response.content[0].text });
  }
});
```
