---
sidebar_position: 2
---

# Filter Node

The filter node conditionally passes or drops a message based on a query against the message context.

## When to Use

- Block messages that don't meet certain criteria
- Only broadcast events where specific data fields match a condition
- Combine with transform to filter-then-enrich pipelines

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filter` | object | Yes | MongoDB-style query object |

## Filter Scope

Filters can match against two namespaces:

| Prefix | Targets |
|--------|---------|
| `data.` | Fields in the message payload |
| `metadata.` | `appId`, `channel`, `event` |

Omitting a prefix matches directly against the top-level object.

## Query Operators

| Operator | Meaning |
|----------|---------|
| `$eq` | Equal |
| `$ne` | Not equal |
| `$gt` | Greater than |
| `$gte` | Greater than or equal |
| `$lt` | Less than |
| `$lte` | Less than or equal |
| `$in` | Value is in array |
| `$nin` | Value is not in array |
| `$and` | All conditions must match |
| `$or` | At least one condition must match |
| `$nor` | None of the conditions match |
| `$not` | Inverts a condition |

## Examples

### Filter by payload field

Pass only messages where `data.active` is `true`:

```json
{
  "filter": {
    "data.active": true
  }
}
```

### Filter by event name (metadata)

Pass only `message` events:

```json
{
  "filter": {
    "metadata.event": "message"
  }
}
```

### Combined AND filter

Pass only messages where `data.priority >= 5` **and** the event is `alert`:

```json
{
  "filter": {
    "$and": [
      { "data.priority": { "$gte": 5 } },
      { "metadata.event": "alert" }
    ]
  }
}
```

### Allow only specific users

```json
{
  "filter": {
    "data.userId": { "$in": ["user-1", "user-2", "user-3"] }
  }
}
```

## Behaviour on Mismatch

When the filter condition is not met the pipeline stops. No further nodes run and no broadcast is emitted. The client receives an error reply.

## Limitations

- Aggregation queries (`$group`, `$sum`, etc.) are not supported.
- Joins across multiple documents are not supported.
- Regex matching (`$regex`) is not supported.

## Next Steps

- [Transform Node](/docs/tutorial-basics/transform-node) — reshape data that passes the filter
- [Schema Validator Node](/docs/tutorial-basics/schema-validator-node) — validate data shape with JSON Schema
