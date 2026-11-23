---
sidebar_position: 6
---

# HTTP API

Every Durable Object operation is available over REST. Useful for server-to-server calls, scripts, and languages without an SDK.

All endpoints are under `/api/v1/objects/{app_id}/{type}/{key}`. `{app_id}` may be your App Key or your app's id.

---

## Authentication

Every request carries your app credentials as headers (server-to-server only — never from a browser):

| Header | Value |
|---|---|
| `X-App-Key` | Your App Key |
| `X-App-Secret` | Your App Secret |
| `Content-Type` | `application/json` |

```bash
curl https://your-host/api/v1/objects/$APP_KEY/order/order-42 \
  -H "X-App-Key: $APP_KEY" \
  -H "X-App-Secret: $APP_SECRET"
```

The server SDK sends these headers for you.

---

## Endpoints

### Read full state

```http
GET /api/v1/objects/{app_id}/{type}/{key}
```

**Response:**

```json
{
  "state": {
    "status":      "processing",
    "assigned_to": "agent-7",
    "retry_count": 2
  },
  "log_id": 17
}
```

---

### Read a single slot

```http
GET /api/v1/objects/{app_id}/{type}/{key}/{slot}
```

**Response:**

```json
{ "value": "processing" }
```

A slot that doesn't exist returns `{ "value": null }`.

---

### Set a single slot

```http
PUT /api/v1/objects/{app_id}/{type}/{key}/{slot}
Content-Type: application/json

{ "value": "shipped" }
```

**Response:**

```json
{ "log_id": 18 }
```

---

### Set multiple slots (atomic)

```http
PATCH /api/v1/objects/{app_id}/{type}/{key}
Content-Type: application/json

{
  "status":     "shipped",
  "shipped_at": 1718884800000
}
```

**Response:**

```json
{ "log_id": 19 }
```

---

### Increment

```http
POST /api/v1/objects/{app_id}/{type}/{key}/increment
Content-Type: application/json

{ "slot": "retry_count", "by": 1 }
```

`by` defaults to `1`. The slot is treated as `0` if it doesn't exist.

**Response:**

```json
{ "log_id": 20, "value": 3 }
```

---

### Append

```http
POST /api/v1/objects/{app_id}/{type}/{key}/append
Content-Type: application/json

{
  "slot":  "history",
  "value": { "event": "shipped", "at": 1718884800000 }
}
```

**Response:**

```json
{ "log_id": 21 }
```

---

### Delete a slot

```http
DELETE /api/v1/objects/{app_id}/{type}/{key}/{slot}
```

**Response:**

```json
{ "log_id": 22 }
```

---

### Transaction

Apply a list of ops atomically, in order — all commit or none do. The request body is a JSON array of ops:

```http
POST /api/v1/objects/{app_id}/{type}/{key}/transaction
Content-Type: application/json

[
  { "op": "set",       "key": "status",      "value": "shipped" },
  { "op": "increment", "key": "retry_count", "by": 1 },
  { "op": "append",    "key": "history",     "value": { "event": "shipped" } },
  { "op": "delete",    "key": "temp_lock" }
]
```

**Response:**

```json
{ "log_id": 23 }
```

Ops: `set` (`key`, `value`), `delete` (`key`), `increment` (`key`, `by`), `append` (`key`, `value`). If an op cannot apply (for example `append` to a slot that is not a list) nothing commits and the response is `422`. There is no read op and no server-side condition: to write only when `status == "processing"`, read with `GET` first — the read and the write are not atomic together.

---

### Replay log

```http
GET /api/v1/objects/{app_id}/{type}/{key}/log?after=17
```

Returns all log entries with `log_id > 17`, in order.

**Response:**

```json
{
  "items": [
    { "op": "set",    "key": "status",     "value": "shipped",     "log_id": 18 },
    { "op": "set",    "key": "shipped_at", "value": 1718884800000, "log_id": 19 },
    { "op": "append", "key": "events",     "item": { "type": "shipped" }, "log_id": 20 }
  ]
}
```

Every write op is its own entry: `setAll` and `transaction` log one `set` /
`delete` / `append` entry per slot, with consecutive `log_id`s. `increment` is
logged as a `set` of the new value. `append` entries carry only the appended
`item`, not the whole list.

---

### Purge

Permanently deletes all state and log entries for the object.

```http
DELETE /api/v1/objects/{app_id}/{type}/{key}
```

**Response:** `204 No Content`

---

## Error responses

Error bodies are JSON with a stable `error` code, never an internal term.

| Status | Body | Meaning |
|---|---|---|
| `400` | `{ "error": "<code>" }` | malformed body or query (e.g. a missing `value`, a non-integer `by` or `after`) |
| `401` | `{ "errors": [{ "status": "401", "title": "Unauthorized" }] }` | bad / missing headers, or the path `app_id` isn't the authenticated app |
| `422` | `{ "error": "not_a_number" \| "not_a_list", "slot": "<slot>" }` or `{ "error": "invalid_transaction_operation", "operation": {...} }` | the data rejected the write; retrying it unchanged fails again |
| `503` | `{ "error": "<code>" }` | storage unavailable (e.g. `insufficient_replicas`). A read or purge, or a write that failed before any replica was written: it did not commit, retry it |
| `500` | `{ "error": "write_outcome_unknown", "cause": "<code>" }` | a write failed while replicas were being written (e.g. `write_quorum`, a timeout): it may have committed. Don't retry a non-idempotent write blindly; read the object to check |

The server SDKs retry a `503` on any request; they never retry a `POST` on
`500` (`write_outcome_unknown`).
