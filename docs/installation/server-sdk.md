---
sidebar_position: 1
---

# Server SDK Installation

## Node.js

```bash
npm install pingerchips-js-server
```

Requires Node.js ≥ 14. ESM only — add `"type": "module"` to your `package.json` or use the `.mjs` extension.

```javascript
import PingerchipsServer from 'pingerchips-js-server';

const pingerchips = new PingerchipsServer(
  process.env.PINGERCHIPS_APP_KEY,
  process.env.PINGERCHIPS_APP_SECRET,
  { endpoint: 'https://queue.pingerchips.com' }
);

await pingerchips.trigger('my-channel', 'my-event', {
  message: 'Hello from server!',
});
```

## Python

```bash
pip install pingerchips
```

Requires Python ≥ 3.10.

```python
from pingerchips import PingerChips

pc = PingerChips(
    host="https://queue.pingerchips.com",
    app_id=os.environ["PINGERCHIPS_APP_KEY"],
    app_secret=os.environ["PINGERCHIPS_APP_SECRET"],
)

pc.trigger("my-channel", "my-event", {"message": "Hello from server!"})
```

## Environment Variables

```bash
PINGERCHIPS_APP_KEY=your-app-key
PINGERCHIPS_APP_SECRET=your-app-secret
```

Never commit your App Secret. Keep it in environment variables only.

## Next Steps

- [Server SDK Reference](/docs/sdk/server-sdk) — full API documentation including authentication
- [HMAC Signing](/docs/hmac-signing) — how request signing works
- [Channel Types](/docs/sdk/channels) — public, private, presence
