---
sidebar_position: 2
---

# Client SDK Installation

## Install

```bash
npm install pingerchips-js
```

Requires ESM. Add `"type": "module"` to your `package.json`, or use the `.mjs` extension.

## Basic Usage

```javascript
import Pingerchips from 'pingerchips-js';

const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://queue.pingerchips.com/socket',
});

const channel = await client.subscribe('my-channel');

channel.bind('my-event', (data) => {
  console.log('Received:', data);
});
```

## With Authentication (Private/Presence Channels)

```javascript
const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://queue.pingerchips.com/socket',
  authEndpoint: 'https://your-server.com/pingerchips/auth',
  authInfo: { token: userSessionToken },
});

const channel = await client.subscribe('private-user-123');
channel.bind('notification', (data) => console.log(data));
```

## Next Steps

- [Client SDK Reference](/docs/sdk/client-sdk) — full API documentation
- [Channel Types](/docs/sdk/channels) — public, private, presence
