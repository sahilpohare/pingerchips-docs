---
sidebar_position: 1
---

# Server SDK Installation

Install the Pingerchips Server SDK or use the Pusher-compatible SDK.

## Option 1: Pingerchips Server SDK (Recommended)

```bash
npm install pingerchips-js-server
```

### Usage

```javascript
import PingerchipsServer from 'pingerchips-js-server';

const pingerchips = new PingerchipsServer('APP_ID', 'APP_SECRET', {
  appKey: 'APP_KEY',
  endpoint: 'https://pinger-processor.pingerchips.com/api',
  token: 'YOUR_API_TOKEN'
});

// Trigger an event
await pingerchips.trigger('my-channel', 'my-event', {
  message: 'Hello from server!'
});
```

**Benefits:**
- Built specifically for Pingerchips
- Supports authentication for private/presence channels
- mTLS support for production
- Modern ES6+ syntax

See the [Server SDK Guide](/docs/sdk/server-sdk) for complete documentation.

## Option 2: Pusher SDK (Compatible)

You can use any [Pusher Server SDK](https://pusher.com/docs/channels/channels_libraries/libraries/) with Pingerchips.

```bash
npm install pusher
```

### Usage

```javascript
const Pusher = require('pusher');

const pusher = new Pusher({
  appId: 'YOUR_APP_ID',
  key: 'YOUR_APP_KEY',
  secret: 'YOUR_APP_SECRET',
  host: 'pinger-processor.pingerchips.com',
  port: 443,
  useTLS: true
});

await pusher.trigger('my-channel', 'my-event', {
  message: 'Hello World'
});
```

## Next Steps

- Read the full [Server SDK documentation](/docs/sdk/server-sdk)
- Learn about [channel types](/docs/sdk/channels)
- Set up [authentication](/docs/sdk/server-sdk#authentication) for private channels
