---
sidebar_position: 3
---

# Delay Node

The delay node pauses pipeline execution for a fixed duration before continuing to the next step.

## When to Use

- Introduce a cool-down between events
- Rate-shape bursts of messages
- Simulate processing time in test flows

## Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `duration` | number | Yes | — | Amount of time to wait |
| `unit` | string | No | `"ms"` | Time unit: `"ms"`, `"s"`, or `"m"` |

:::note
Maximum delay is **5 minutes** (300,000 ms). Larger values are silently clamped.
:::

## Examples

```json
{ "duration": 500 }
```
Waits 500 ms.

```json
{ "duration": 30, "unit": "s" }
```
Waits 30 seconds.

```json
{ "duration": 2, "unit": "m" }
```
Waits 2 minutes (clamped to 5 min max if higher).

## Flow Editor

Set **Duration** and pick a unit from the dropdown. The node shows the effective wait time in the preview.

## Next Steps

- [Throttle Node](/docs/tutorial-basics/throttle-node) — drop messages that arrive too fast
- [Debounce Node](/docs/tutorial-basics/debounce-node) — wait for a quiet period before processing
