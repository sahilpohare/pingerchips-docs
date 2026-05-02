---
sidebar_position: 1
---

# Getting Started With Flows

**Pingerflows** let you intercept messages as they arrive and run them through a processing pipeline before they are delivered to subscribers. You can filter, transform, throttle, validate, and reroute events — all without touching your backend code.

## What Is a Flow?

A flow is a sequence of **nodes** attached to a specific channel. When a message arrives on that channel it is passed through each node in order. If all nodes succeed the message (and any broadcasts produced by the flow) is delivered. If any node fails or drops the message, delivery stops.

```
Incoming message → [Node 1] → [Node 2] → [Node N] → Broadcast
```

## Creating a Flow

1. Go to **Dashboard → Apps → [Your App] → Flows**
2. Click **Add Flow**
3. Give the flow a **name** and set the **channel** it listens on
4. Click **Create** — you are redirected to the flow editor
5. Add nodes and configure them
6. Click **Publish** to deploy

:::tip
One flow per channel. A channel can only have one active flow at a time.
:::

:::note
If no flow exists for a channel, messages pass through and are broadcast as-is (passthrough mode).
:::

## The Flow Editor

The editor is a visual drag-and-drop interface. Each node appears as a card; nodes execute top-to-bottom.

- **Add a node** — click the **+** button between steps
- **Configure a node** — click the node card to open its settings panel
- **Reorder nodes** — drag cards up or down
- **Delete a node** — click the trash icon on the card
- **Publish** — deploy the current flow; changes are live immediately

## Available Nodes

| Node | Purpose |
|------|---------|
| [**Filter**](/docs/tutorial-basics/filter-node) | Drop messages that don't match a MongoDB-style query |
| [**Transform**](/docs/tutorial-basics/transform-node) | Reshape data with a JavaScript function |
| [**Schema Validator**](/docs/tutorial-basics/schema-validator-node) | Validate payload shape against a JSON Schema |
| [**Throttle**](/docs/tutorial-basics/throttle-node) | Allow only the first message in a time window; drop the rest |
| [**Debounce**](/docs/tutorial-basics/debounce-node) | Wait for a quiet period, then process only the last message |
| [**Delay**](/docs/tutorial-basics/delay-node) | Pause execution for a fixed duration |
| [**Send to Channel**](/docs/tutorial-basics/send-to-channel-node) | Broadcast the (optionally transformed) message to a channel |

## Execution Timeout

Flows have a maximum execution time of **5 seconds**. If a flow exceeds this limit the message is dropped and the client receives a timeout error. Keep transforms lightweight and avoid long delays in critical paths.

## Example Flows

### Chat moderation

1. **Schema Validator** — require `text` (string) and `userId` (string)
2. **Filter** — block messages where `data.text` contains banned words (using `$nin` or a custom filter)
3. **Transform** — add `serverTimestamp` to the payload
4. **Send to Channel** — broadcast to the same channel

### Rate-limited notifications

1. **Throttle** — allow one notification per 10 seconds per channel
2. **Send to Channel** — broadcast to `notifications-{{data.userId}}`

### Typing indicator collapse

1. **Debounce** — 300 ms window
2. **Send to Channel** — broadcast `typing-stopped` event

## Publishing Flows

Click **Publish** in the flow editor. The flow is compiled, cached, and active immediately. Existing connections receive the new flow on their next message — no reconnection needed.

## Next Steps

- [Filter Node](/docs/tutorial-basics/filter-node)
- [Transform Node](/docs/tutorial-basics/transform-node)
- [Schema Validator Node](/docs/tutorial-basics/schema-validator-node)
- [Throttle Node](/docs/tutorial-basics/throttle-node)
- [Debounce Node](/docs/tutorial-basics/debounce-node)
- [Delay Node](/docs/tutorial-basics/delay-node)
- [Send to Channel Node](/docs/tutorial-basics/send-to-channel-node)
