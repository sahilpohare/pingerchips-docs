---
sidebar_position: 5
---

# Debounce Node

The debounce node implements **trailing-edge debouncing**: every incoming message resets a timer, and only the *last* message is processed after the timer expires with no new arrivals.

## When to Use

- Collapse rapid-fire user input (e.g. typing indicators, search-as-you-type)
- Wait for a burst of updates to settle before broadcasting
- Prevent redundant processing when many events arrive in quick succession

## How It Works

1. A message arrives → it is **parked** (not forwarded) and the debounce timer is (re)started.
2. If another message arrives before the timer fires → the timer resets with the new message.
3. When the timer fires with no new arrivals → the last parked message is **re-enqueued** and runs through the pipeline again from the top.
4. On the second pass the debounce node detects the re-enqueued marker and **passes through**.

:::info
Debounce is **in-memory per node** (backed by ETS). State is local to the server instance and resets on restart.
:::

## Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `window` | number | Yes | — | Quiet period to wait |
| `unit` | string | No | `"ms"` | Time unit: `"ms"`, `"s"`, or `"m"` |

## Examples

Debounce with a 300 ms window (good for typing indicators):

```json
{ "window": 300 }
```

Debounce with a 2 second window:

```json
{ "window": 2, "unit": "s" }
```

## Difference from Throttle

| | Throttle | Debounce |
|---|---|---|
| Which message passes | **First** in window | **Last** after quiet period |
| Dropped messages | All after the first within window | All except the final one |
| Use case | Rate limiting | Collapse bursts |

## Next Steps

- [Throttle Node](/docs/tutorial-basics/throttle-node) — limit message rate with leading-edge throttle
- [Filter Node](/docs/tutorial-basics/filter-node) — conditionally block messages
