---
sidebar_position: 6
---

# HTTP API

Every Durable Object operation is available over REST. Useful for server-to-server calls, scripts, and languages without an SDK.

All endpoints are under `/api/v1/objects/{app_id}/{type}/{key}` and require HMAC authentication.

---

## Authentication

Each request must be signed with your App Key and Secret:

| Header | Value |
|---|---|
| `X-App-Key` | Your App Key (`pk_live_...`) |
| `X-Signature` | HMAC-SHA256 of `{timestamp}:{method}:{path}:{body_hash}` |
| `X-Timestamp` | Unix timestamp (seconds). Requests older than 5 minutes are rejected. |

### Signing (Node.js)

```js
import crypto from 'crypto';

function signRequest(method, path, body, secret) {
  const timestamp  = Math.floor(Date.now() / 1000).toString();
  const bodyHash   = crypto.createHash('sha256').update(body ?? '').digest('hex');
  const message    = `${timestamp}:${method}:${path}:${bodyHash}`;
  const signature  = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return { timestamp, signature };
}

const body = JSON.stringify({ value: 'shipped' });
const { timestamp, signature } = signRequest('PUT', '/api/v1/objects/.../status', body, APP_SECRET);
```

The server SDK handles signing automatically. Use manual signing only when calling from a language without an SDK.

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
{ "value": "processing", "log_id": 3 }
```

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

{ "slot": "retry_count", "delta": 1 }
```

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

Atomic read-modify-write. The request body is an array of operations. Reads are executed first, then writes — in the order provided.

```http
POST /api/v1/objects/{app_id}/{type}/{key}/transaction
Content-Type: application/json

{
  "ops": [
    { "op": "get",    "slot": "status" },
    { "op": "set",    "slot": "status",  "value": "shipped" },
    { "op": "append", "slot": "history", "value": { "event": "shipped" } }
  ]
}
```

**Response:**

```json
{
  "log_id": 23,
  "reads": {
    "status": "processing"
  }
}
```

If you need conditional logic (e.g. only write if status == "processing"), handle it in your calling code: call `GET` first, then `POST /transaction`. For fully atomic conditional writes, use the server SDK `transaction(fn)` which runs the condition check inside the serialised GenServer.

---

### Replay log

```http
GET /api/v1/objects/{app_id}/{type}/{key}/log?after=17
```

Returns all log entries with `log_id > 17`, in order.

**Response:**

```json
{
  "entries": [
    { "log_id": 18, "op": "set",    "key": "status",  "value": "shipped" },
    { "log_id": 19, "op": "set_all", "changes": { "status": "shipped", "shipped_at": 1718884800000 } }
  ]
}
```

---

### Purge

Permanently deletes all state and log entries for the object.

```http
DELETE /api/v1/objects/{app_id}/{type}/{key}
```

**Response:** `204 No Content`

---

## Error responses

| Status | Meaning |
|---|---|
| `400` | Missing or invalid body |
| `401` | Missing or invalid signature / timestamp expired |
| `403` | App disabled or key mismatch |
| `404` | Slot not found (on GET slot) |
| `409` | Transaction conflict (retry) |
| `422` | Validation error (e.g. increment on non-numeric slot) |

```json
{ "error": "slot not found", "slot": "temp_lock" }
```
