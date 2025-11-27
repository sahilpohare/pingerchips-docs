---
sidebar_position: 2
---

# Client SDK Installation

Install the Pingerchips Client SDK or use the Pusher-compatible SDK.

## Option 1: Pingerchips Client SDK (Recommended)

```bash
npm install pingerchips-js
```

### Usage

```javascript
import Pingerchips from 'pingerchips-js';

const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://pinger-processor.pingerchips.com/socket'
});

const channel = await client.subscribe('my-channel');

channel.bind('my-event', (data) => {
  console.log('Received:', data);
});
```

**Benefits:**
- Built specifically for Pingerchips
- Supports public, private, and presence channels
- Built on Phoenix Channels for reliability
- Modern async/await support

See the [Client SDK Guide](/docs/sdk/client-sdk) for complete documentation.

## Option 2: Pusher JS SDK (Compatible)

You can use any [Pusher Client SDK](https://pusher.com/docs/channels/channels_libraries/libraries/) with Pingerchips.

```bash
npm install pusher-js
```

### Usage

```javascript
import Pusher from 'pusher-js';

const pusher = new Pusher('YOUR_APP_KEY', {
  wsHost: 'pinger-processor.pingerchips.com',
  wsPort: 443,
  forceTLS: true,
  encrypted: true,
  disableStats: true,
  enabledTransports: ['ws', 'wss']
});

const channel = pusher.subscribe('my-channel');
channel.bind('my-event', (data) => {
  alert('Received: ' + data.message);
});
```

## CDN Installation

For quick prototyping, you can use the CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/phoenix@1.7.0/priv/static/phoenix.min.js"></script>
<script src="https://unpkg.com/pingerchips-js@latest/index.js"></script>

<script>
  const client = new Pingerchips('YOUR_APP_KEY', {
    endpoint: 'wss://pinger-processor.pingerchips.com/socket'
  });

  client.subscribe('my-channel').then(channel => {
    channel.bind('my-event', data => {
      console.log('Received:', data);
    });
  });
</script>
```

## Next Steps

- Read the full [Client SDK documentation](/docs/sdk/client-sdk)
- Learn about [channel types](/docs/sdk/channels)
- Build a [real-time chat application](/docs/getting-started#complete-example)
