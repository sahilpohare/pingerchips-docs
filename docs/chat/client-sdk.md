---
sidebar_position: 4
---

# Client SDK

Import from `pingerchips-js/chat`.

```js
import { PingerchipsChat } from 'pingerchips-js/chat';
```

---

## PingerchipsChat

The root client. Manages the WebSocket connection and thread lifecycle.

### Constructor

```ts
new PingerchipsChat(options: ChatOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `appKey` | string | yes | Your Pingerchips App Key |
| `host` | string | yes | WebSocket host (`wss://...`) |
| `authenticateChat` | function | yes | Returns HMAC auth token for a thread join |
| `reconnect` | boolean | no | Auto-reconnect on disconnect (default: `true`) |
| `reconnectDelay` | number | no | Base delay in ms (default: `1000`) |

#### `authenticateChat` signature

```ts
authenticateChat(params: {
  socketId: string;
  threadId: string;
  clientId: string;
}) => Promise<string>
```

Should call your server which proxies to `POST /api/chat/auth`. Returns the `auth` string (`appKey:hmac_signature`).

---

### Methods

#### `connect(): Promise<void>`

Opens the WebSocket connection. Call this before `joinThread`.

```js
await chat.connect();
```

#### `joinThread(threadId, options): Promise<ChatSession>`

Joins a thread channel and returns a `ChatSession`.

```ts
joinThread(threadId: string, options: {
  clientId: string;
}) => Promise<ChatSession>
```

```js
const session = await chat.joinThread('thread-uuid', { clientId: 'user-42' });
```

#### `leaveThread(threadId): void`

Leaves and cleans up the thread channel.

#### `disconnect(): void`

Closes the WebSocket.

---

## ChatSession

Represents a joined thread. Obtained from `chat.joinThread(...)`.

### State

#### `session.snapshot`

The current thread snapshot — messages, thread metadata, run state. Populated on join from the WAL snapshot reply.

```ts
{
  threadId: string;
  status: 'open' | 'bot' | 'pending' | 'active' | 'resolved';
  title: string | null;
  messages: Message[];
  activeRuns: Record<string, ActiveRun>;
}
```

### Sending messages

#### `send(text, options?): Promise<Message>`

Sends a user message to the thread.

```ts
send(text: string, options?: {
  parentId?: string;    // attach to a specific message in the tree
  metadata?: object;
}) => Promise<Message>
```

```js
const msg = await session.send('What is the capital of France?');
```

#### `edit(messageId, newText): Promise<Message>`

Edits a previously sent user message. Creates a fork in the conversation tree.

```js
const edited = await session.edit(msg.id, 'What is the capital of Germany?');
```

### Loading history

#### `getHistory(): Promise<HistoryPage>`

Returns the most recent 50 messages.

```ts
{ messages: Message[], has_older: boolean }
```

#### `loadOlder(beforeMessageId): Promise<HistoryPage>`

Paginates backwards. Pass the `id` of the oldest message you currently have.

```js
let page = await session.getHistory();
while (page.has_older) {
  page = await session.loadOlder(page.messages[0].id);
  prependToUI(page.messages);
}
```

### Run controls

#### `cancelRun(runId): Promise<void>`

Sends a `cancel` event to abort an in-progress run.

#### `regenerate(messageId): Promise<void>`

Asks the agent to regenerate the assistant message with id `messageId`. The server creates a fork; the agent receives a `regenerate` event.

#### `approveToolCall(runId, toolCallId, result): Promise<void>`

Approves a pending tool call during a suspended run. Resumes the run with `result` as the tool output.

### Event listeners

#### `onMessage(handler): () => void`

Fires when a new message is committed to the thread (i.e. on `run:end` or after a user `send`).

```js
const off = session.onMessage((message: Message) => {
  appendToUI(message);
});

// Cleanup
off();
```

#### `onToken(handler): () => void`

Fires on each `change` event for a `stream:{runId}` slot — i.e. each time the token rollup buffer flushes (every ~40 ms).

```js
session.onToken((runId: string, content: string) => {
  updateStreamingBubble(runId, content);
});
```

Note: `content` is the **full accumulated content** of the run so far, not a delta. Set your streaming bubble's text directly rather than appending.

#### `onRunStart(handler): () => void`

Fires when an agent pushes `run:start`.

```js
session.onRunStart((runId: string, agentId: string) => {
  showTypingIndicator(agentId);
});
```

#### `onRunEnd(handler): () => void`

Fires when a run completes (successfully or cancelled).

```js
session.onRunEnd((runId: string) => {
  hideTypingIndicator();
});
```

#### `onRunSuspend(handler): () => void`

Fires when a run suspends waiting for a tool approval.

```js
session.onRunSuspend((runId: string, toolCalls: ToolCall[]) => {
  showApprovalUI(runId, toolCalls);
});
```

#### `onError(handler): () => void`

Fires on channel errors.

---

## View (React helper)

`View` is a React hook-friendly wrapper around `ChatSession` that manages state automatically.

```js
import { View } from 'pingerchips-js/chat';

const view = new View(session);

// Returns current messages, sorted and with in-progress runs merged in
const messages = view.messages();

// Subscribe to re-renders
view.subscribe(() => setMessages(view.messages()));
```

### `view.messages(): Message[]`

Returns the current flat list of messages. In-progress runs are included as a synthetic message with `role: 'assistant'` and the current streamed `content`.

### `view.subscribe(callback): () => void`

Registers a callback that fires whenever state changes. Returns an unsubscribe function.

---

## Types

```ts
interface Message {
  id:            string;
  thread_id:     string;
  role:          'user' | 'assistant' | 'tool' | 'system';
  content:       { text: string } | object;
  run_id?:       string;
  parent_id?:    string;
  fork_of?:      string;
  inserted_at:   string; // ISO 8601
}

interface ActiveRun {
  runId:    string;
  agentId:  string;
  content:  string;   // accumulated tokens so far
  status:   'running' | 'suspended';
}

interface ToolCall {
  id:        string;
  name:      string;
  arguments: object;
}
```
