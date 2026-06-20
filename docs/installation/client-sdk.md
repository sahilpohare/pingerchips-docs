---
sidebar_position: 2
---

# Client SDK Installation

## JavaScript

```bash
npm install pingerchips-js
```

Requires ESM. Add `"type": "module"` to your `package.json`, or use the `.mjs` extension.

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

## Python

```bash
pip install pingerchips
```

Requires Python ≥ 3.10.

```python
import asyncio
from pingerchips import PingerChipsClient

async def main():
    client = PingerChipsClient(
        host="wss://queue.pingerchips.com",
        app_key="YOUR_APP_KEY",
    )
    await client.connect()

    ch = await client.subscribe("my-channel")
    ch.on("message", lambda data: print("Received:", data))

    await client.listen()

asyncio.run(main())
```

## With Authentication (Private/Presence Channels)

**JavaScript:**
```javascript
const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://queue.pingerchips.com/socket',
  authEndpoint: 'https://your-server.com/pingerchips/auth',
  authInfo: { token: userSessionToken },
});

const channel = await client.subscribe('private-user-123');
channel.bind('notification', (data) => console.log(data));
```

**Python:**
```python
client = PingerChipsClient(
    host="wss://queue.pingerchips.com",
    app_key="YOUR_APP_KEY",
    app_secret="YOUR_APP_SECRET",  # used to auto-sign private/presence channel joins
)
await client.connect()

ch = await client.subscribe("private-user-123")
ch.on("message", lambda data: print(data))
```

## Next Steps

- [Client SDK Reference](/docs/sdk/client-sdk) — full API documentation
- [Channel Types](/docs/sdk/channels) — public, private, presence
