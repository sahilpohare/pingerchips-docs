---
sidebar_position: 6
---

# Schema Validator Node

The schema validator node validates incoming message data against a [JSON Schema](https://json-schema.org/) (draft 4/7). If validation fails the pipeline stops and no broadcast is emitted.

## When to Use

- Enforce a strict contract on client-sent messages
- Reject malformed payloads early in the flow
- Prevent downstream nodes from receiving unexpected data shapes

## Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `schema` | object | Yes | — | A valid JSON Schema object |
| `target` | string | No | `"data"` | What to validate: `"data"`, `"metadata"`, or `"both"` |

### `target` values

| Value | Validates |
|-------|-----------|
| `"data"` | `context.data` — the message payload sent by the client or server |
| `"metadata"` | `context.metadata` — contains `appId`, `channel`, `event` |
| `"both"` | Merged `metadata` + `data` |

## Examples

### Require specific fields in the payload

```json
{
  "schema": {
    "type": "object",
    "required": ["userId", "text"],
    "properties": {
      "userId": { "type": "string" },
      "text":   { "type": "string", "maxLength": 500 }
    }
  }
}
```

### Validate a numeric amount with constraints

```json
{
  "schema": {
    "type": "object",
    "required": ["amount", "currency"],
    "properties": {
      "amount":   { "type": "number", "minimum": 0 },
      "currency": { "type": "string", "enum": ["USD", "EUR", "GBP"] }
    }
  }
}
```

### Validate metadata only

```json
{
  "schema": {
    "type": "object",
    "required": ["appId"],
    "properties": {
      "appId": { "type": "string" }
    }
  },
  "target": "metadata"
}
```

## Supported JSON Schema Keywords

Full JSON Schema draft 4/7 is supported, including:

- `type`, `enum`, `const`
- `required`, `properties`, `additionalProperties`
- `minLength`, `maxLength`, `pattern`
- `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`
- `minItems`, `maxItems`, `items`, `uniqueItems`
- `allOf`, `anyOf`, `oneOf`, `not`
- `$ref` (within the same schema document)

## On Failure

Validation errors are collected and returned as a human-readable string:

```
Schema validation failed on data: #/userId: Expected type string, got null, #/amount: Value must be >= 0
```

The pipeline stops; no downstream nodes run and no broadcast is emitted.

## Next Steps

- [Filter Node](/docs/tutorial-basics/filter-node) — filter using MongoDB-style query operators
- [Transform Node](/docs/tutorial-basics/transform-node) — reshape data after validation
