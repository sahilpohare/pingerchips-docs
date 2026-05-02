---
sidebar_position: 1
---

# Transform Node

The transform node executes a user-defined JavaScript function to reshape the message context before it continues down the pipeline or is broadcast.

## When to Use

- Add computed fields to a message payload
- Remove or rename fields before broadcasting to clients
- Change the event name or metadata values
- Merge static data into every message

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transformer` | string | Yes* | Full JS function (exported as default or standalone) |
| `code` | string | Yes* | Inline JS expression that returns a context object |

\* Provide exactly one of `transformer` or `code`.

## JavaScript Context Object

Your function receives and must return a **context** object:

```javascript
{
  metadata: {
    appId:   "your-app-id",
    channel: "chat-room",
    event:   "new-message"
  },
  data: {
    // message payload from the client or server
  },
  broadcasts: []  // do not modify directly
}
```

Return the full context object (modified as needed). Returning `null` or a non-object will cause the pipeline to error.

## Examples

### Add a server timestamp

```javascript
export default function transform(context) {
  return {
    ...context,
    data: {
      ...context.data,
      serverTimestamp: Date.now(),
    }
  };
}
```

### Remove a sensitive field

```javascript
export default function transform(context) {
  const { password, ...safeData } = context.data;
  return { ...context, data: safeData };
}
```

### Change the event name

```javascript
export default function transform(context) {
  return {
    ...context,
    metadata: {
      ...context.metadata,
      event: 'processed-message',
    }
  };
}
```

### Inline code style (no export)

```javascript
return {
  ...context,
  data: { ...context.data, processed: true }
};
```

## Runtime Limits

| Limit | Value |
|-------|-------|
| Execution time | 5 seconds (shared with full flow) |
| Memory | 8 MB |
| Network access | Not allowed (`fetch`, `XMLHttpRequest`, etc.) |
| File system | Not allowed |
| `setTimeout` / `setInterval` | Not allowed |

The runtime is **QuickJS** — a sandboxed JavaScript engine. ES2020 syntax is supported. Node.js built-ins (`fs`, `path`, `http`, etc.) are not available.

:::note
Transform functions are **pure** — they receive the context and return a new context. Side effects are not supported and will fail silently or error.
:::

## Bytecode Caching

Transforms are compiled to bytecode and cached in Redis. The first execution after a flow publish compiles the function; subsequent executions use cached bytecode for faster dispatch.

## Next Steps

- [Filter Node](/docs/tutorial-basics/filter-node) — filter messages before or after transforming
- [Send to Channel Node](/docs/tutorial-basics/send-to-channel-node) — broadcast the transformed message
- [Schema Validator Node](/docs/tutorial-basics/schema-validator-node) — validate shape before transforming
