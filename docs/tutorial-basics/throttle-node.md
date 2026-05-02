---
sidebar_position: 4
---

# Throttle Node

The throttle node implements **leading-edge throttling**: the first message in a time window passes through, and all subsequent messages arriving within that window are dropped.

## When to Use

- Prevent a single user or channel from flooding subscribers
- Limit high-frequency sensor/telemetry data to a manageable rate
- Cap game-state broadcasts to a fixed tick rate

## How It Works

When a message arrives:

1. If no message has passed in the current window → **allow** and start the window timer.
2. If a message already passed within the window → **drop** (the pipeline stops here).
3. When the window expires, the next message starts a new window.

:::info
Throttle is **in-memory per node** (backed by ETS, not Redis). State is local to the server instance and resets on restart.
:::

## Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `window` | number | Yes | — | Length of the throttle window |
| `unit` | string | No | `"s"` | Time unit: `"ms"`, `"s"`, or `"m"` |

## Examples

Allow at most one message every 5 seconds:

```json
{ "window": 5, "unit": "s" }
```

Allow at most one message every 200 ms:

```json
{ "window": 200, "unit": "ms" }
```

Allow at most one message per minute:

```json
{ "window": 1, "unit": "m" }
```

## Behaviour on Drop

When a message is throttled the pipeline stops. No further nodes execute and no broadcast is emitted for that message. The client receives an error reply (`{reason: "Flow execution failed"}`).

## Next Steps

- [Debounce Node](/docs/tutorial-basics/debounce-node) — process only the *last* message after a quiet period
- [Delay Node](/docs/tutorial-basics/delay-node) — add a fixed pause without dropping messages
