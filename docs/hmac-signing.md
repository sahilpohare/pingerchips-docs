---
sidebar_position: 5
---

# HMAC Request Signing

When triggering events via the HTTP API from your server, Pingerchips verifies the request using an HMAC-SHA256 signature. This prevents replay attacks and confirms the request originated from a trusted source.

## When Is Signing Required?

The HMAC signature is required for the **server-to-client HTTP trigger endpoint**:

```
POST /api/apps/:app_id/trigger
```

The internal API (`/api/trigger`) uses a static `token` header instead. The `pingerchips-js-server` SDK handles signing automatically — you only need to implement this manually if you are calling the HTTP API directly.

---

## Signature Algorithm

### 1. Build the string to sign

```
METHOD\n/path\ntimestamp\nbody
```

- `METHOD` — always `POST`
- `/path` — the full request path, e.g. `/api/apps/YOUR_APP_KEY/trigger`
- `timestamp` — Unix timestamp in **seconds** (integer)
- `body` — the raw JSON body string of the request (keys in exactly this order): `channel`, `event`, `data`

```json
{"channel":"my-channel","event":"my-event","data":{"key":"value"}}
```

### 2. Compute HMAC-SHA256

Sign the string using your **App Secret** as the key:

```javascript
const signature = crypto
  .createHmac('sha256', APP_SECRET)
  .update(stringToSign)
  .digest('hex');
```

### 3. Send the request headers

| Header | Value |
|--------|-------|
| `X-App-Key` | Your App Key |
| `X-Signature` | The hex HMAC signature |
| `X-Timestamp` | Unix timestamp in seconds (same value used to sign) |

---

## Request Body

```json
{
  "channel": "my-channel",
  "event":   "my-event",
  "data":    { "key": "value" }
}
```

---

## Full Example (Node.js)

```javascript
import crypto from 'crypto';
import fetch from 'node-fetch';

const APP_KEY    = process.env.PINGERCHIPS_APP_KEY;
const APP_SECRET = process.env.PINGERCHIPS_APP_SECRET;
const BASE_URL   = 'https://pinger-processor.pingerchips.com';

async function triggerEvent(channel, event, data) {
  const path      = `/api/apps/${APP_KEY}/trigger`;
  const timestamp = Math.floor(Date.now() / 1000);
  const body      = JSON.stringify({ channel, event, data });

  // Canonical string to sign
  const stringToSign = `POST\n${path}\n${timestamp}\n${body}`;

  const signature = crypto
    .createHmac('sha256', APP_SECRET)
    .update(stringToSign)
    .digest('hex');

  const response = await fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Key':    APP_KEY,
      'X-Signature':  signature,
      'X-Timestamp':  String(timestamp),
    },
    body,
  });

  return response.json();
}

// Usage
await triggerEvent('notifications', 'new-message', {
  text: 'Hello from the server!',
  userId: '42',
});
```

---

## Replay Protection

Requests with a timestamp older than **5 minutes** are rejected with:

```json
{ "error": "Request timestamp expired (max 5 minutes)" }
```

Always use the current time when signing. Do not reuse signatures.

---

## Error Responses

| HTTP Status | Error | Cause |
|-------------|-------|-------|
| `403` | `Invalid signature` | Signature mismatch — check secret and string-to-sign format |
| `403` | `Request timestamp expired` | Timestamp > 5 minutes old |
| `404` | `App not found` | `X-App-Key` does not match any app |
| `429` | `Rate limit exceeded` | Backend event rate limit hit |
| `422` | `Validation failed: ...` | Message constraint violation |

---

## Using the Server SDK

If you use `pingerchips-js-server`, signing is handled for you:

```javascript
import PingerchipsServer from 'pingerchips-js-server';

const pingerchips = new PingerchipsServer('APP_ID', 'APP_SECRET', {
  appKey:   'APP_KEY',
  endpoint: 'https://pinger-processor.pingerchips.com/api',
});

await pingerchips.trigger('notifications', 'new-message', {
  text: 'Hello!',
});
```

---

## Next Steps

- [Server SDK](/docs/sdk/server-sdk) — full server SDK reference
- [App Settings](/docs/app-settings) — manage your App Key and Secret
