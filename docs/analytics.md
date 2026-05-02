---
sidebar_position: 4
---

# Analytics

The Analytics page (**Dashboard → Apps → [Your App] → Analytics**) provides real-time metrics for your app.

## Available Metrics

### Connections

| Metric | Description |
|--------|-------------|
| **Active Connections** | Current number of live WebSocket connections |
| **Connection Events** | Total connections established and terminated |

### Messages

| Metric | Description |
|--------|-------------|
| **Messages Received** | Total client-to-server messages |
| **Messages Sent** | Total server-to-client broadcasts |
| **Bytes Received** | Total inbound data volume |
| **Bytes Sent** | Total outbound data volume |

### HTTP API

| Metric | Description |
|--------|-------------|
| **HTTP Calls Received** | Total requests to the trigger HTTP API |
| **HTTP Bytes Received** | Inbound data volume via HTTP API |
| **HTTP Bytes Sent** | Response data volume from HTTP API |

### Flows

| Metric | Description |
|--------|-------------|
| **Flow Timeouts** | Flows that exceeded the 5-second execution limit |

## Real-Time Updates

Analytics data updates in real time via the analytics WebSocket channel. No page refresh needed.

## Interpreting Metrics

**High flow timeouts** — a flow is taking too long. Common causes:
- Transform node JavaScript is computationally expensive
- Delay nodes configured with long durations
- Complex filter conditions on large payloads

**High bytes sent vs received ratio** — normal for fan-out patterns (one message in, many subscribers receive it).

**Active connections near your limit** — review your **Max Connections** setting in [App Settings](/docs/app-settings) or upgrade your plan.

## Next Steps

- [App Settings](/docs/app-settings) — adjust rate limits and connection caps
- [Pingerflows](/docs/tutorial-basics/getting-started) — optimise your message processing pipeline
