---
sidebar_position: 7
---

# Send to Channel Node

The send-to-channel node queues a broadcast instruction to deliver a message to a channel. It supports template interpolation so you can dynamically compute target channels and payloads from event data.

## When to Use

- Route a processed message to one or more channels
- Fan out an event to a different channel than the one it arrived on
- Build dynamic per-user or per-entity channels (e.g. `user-{{data.userId}}`)

## Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `channel` | string | Yes | — | Target channel name. Supports `{{path}}` interpolation |
| `message` | string | Yes | — | Message payload. Supports `{{path}}` interpolation. Can be a JSON string |
| `event` | string | No | Inherited from incoming event | Event name to broadcast |

## Template Interpolation

Use `{{path}}` syntax to inject values from the message context:

| Template | Resolves to |
|----------|-------------|
| `{{data.field}}` | A field from the message payload |
| `{{metadata.event}}` | The incoming event name |
| `{{metadata.appId}}` | The app ID |
| `{{metadata.channel}}` | The originating channel |

Nested paths work too: `{{data.user.id}}`.

## Examples

### Broadcast to the same channel

```json
{
  "channel": "notifications",
  "message": "{{data.text}}"
}
```

### Fan out to a user-specific channel

```json
{
  "channel": "user-{{data.userId}}",
  "message": "{\"status\": \"updated\", \"payload\": \"{{data.payload}}\"}",
  "event": "status-update"
}
```

### Send a JSON object message

Set `message` to a JSON string; subscribers will receive the decoded object:

```json
{
  "channel": "admin-alerts",
  "message": "{\"level\": \"warn\", \"source\": \"{{metadata.channel}}\"}",
  "event": "alert"
}
```

## Broadcast Timing

The broadcast instruction is collected during pipeline execution. All queued broadcasts fire **after** the pipeline completes successfully. If any node fails before this one, no broadcast is sent.

Multiple send-to-channel nodes in the same flow are all executed; each produces an independent broadcast.

## Next Steps

- [Transform Node](/docs/tutorial-basics/transform-node) — reshape data before broadcasting
- [Filter Node](/docs/tutorial-basics/filter-node) — conditionally block broadcasts
- [Channel Types](/docs/sdk/channels) — understand public, private, and presence channels
