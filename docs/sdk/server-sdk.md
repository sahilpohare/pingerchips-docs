---
sidebar_position: 2
---

# Server SDK (Node.js)

The Pingerchips Server SDK allows you to trigger events from your Node.js backend and authenticate users for private and presence channels.

## Installation

```bash
npm install pingerchips-js-server
```

## Quick Start

```javascript
import PingerchipsServer from 'pingerchips-js-server';

const pingerchips = new PingerchipsServer('APP_ID', 'APP_SECRET', {
  appKey: 'APP_KEY',
  endpoint: 'https://pinger-processor.pingerchips.com/api',
  token: 'YOUR_API_TOKEN'
});

// Trigger an event
await pingerchips.trigger('lobby', 'message', {
  text: 'Hello from server!',
  timestamp: Date.now()
});
```

## Configuration

### Constructor Options

```javascript
new PingerchipsServer(appId, appSecret, options)
```

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `appId` | string | Your application ID from the dashboard | Yes |
| `appSecret` | string | Your application secret from the dashboard | Yes |

**Options:**

| Option | Type | Description | Required |
|--------|------|-------------|----------|
| `appKey` | string | Your app key (required for authentication) | Yes* |
| `endpoint` | string | API endpoint URL | No |
| `token` | string | API token for authentication | Yes |
| `mtls` | object | mTLS configuration for secure connections | No |

\* Required if you plan to use authentication for private/presence channels

### Example Configuration

```javascript
const pingerchips = new PingerchipsServer(
  'your-app-id',
  'your-app-secret',
  {
    appKey: 'your-app-key',
    endpoint: 'https://pinger-processor.pingerchips.com/api',
    token: 'your-api-token'
  }
);
```

## Triggering Events

Send events to channels from your backend:

### Basic Usage

```javascript
await pingerchips.trigger('channel-name', 'event-name', {
  message: 'Hello World',
  timestamp: Date.now()
});
```

### Real-World Examples

**Broadcast a notification:**

```javascript
await pingerchips.trigger('announcements', 'new-announcement', {
  title: 'System Maintenance',
  message: 'Scheduled maintenance at 2 AM UTC',
  severity: 'info'
});
```

**Send to a private user channel:**

```javascript
await pingerchips.trigger(`private-user-${userId}`, 'notification', {
  type: 'order-update',
  orderId: '12345',
  status: 'shipped'
});
```

**Update presence channel:**

```javascript
await pingerchips.trigger('presence-game-room', 'game-state-update', {
  players: activePlayersCount,
  currentRound: 3,
  timeRemaining: 45
});
```

## Authentication

Authenticate users for private and presence channels by implementing an auth endpoint.

### Setting Up an Auth Endpoint

Create an endpoint on your server that clients will call to authenticate:

```javascript
import express from 'express';
import PingerchipsServer from 'pingerchips-js-server';

const app = express();
app.use(express.json());

const pingerchips = new PingerchipsServer('app_id', 'app_secret', {
  appKey: 'app_key'
});

app.post('/auth', (req, res) => {
  const { socket_id, channel_name, auth_info } = req.body;

  // 1. Validate the user (check session, JWT, etc.)
  const user = validateUserSession(req, auth_info);

  if (!user) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 2. Check if user has access to this channel
  if (channel_name.startsWith('private-user-')) {
    const requestedUserId = channel_name.replace('private-user-', '');
    if (user.id !== requestedUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  // 3. For presence channels, provide user data
  let userData = null;
  if (channel_name.startsWith('presence-')) {
    userData = {
      user_id: user.id,
      user_info: {
        name: user.name,
        avatar: user.avatar,
        status: user.status
      }
    };
  }

  // 4. Generate auth signature
  const authData = pingerchips.authenticate(socket_id, channel_name, userData);

  res.json(authData);
});

app.listen(3000);
```

### Authentication Method

```javascript
pingerchips.authenticate(socketId, channelName, userData)
```

**Parameters:**

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `socketId` | string | Socket ID from the client | Yes |
| `channelName` | string | Channel name (e.g., "private-chat") | Yes |
| `userData` | object | User data for presence channels | No* |

\* Required for presence channels

**Returns:**

```javascript
{
  auth: "app_key:hmac_signature",
  channel_data: "{\"user_id\":\"123\",...}" // Only for presence channels
}
```

### Private Channel Example

```javascript
app.post('/auth', (req, res) => {
  const { socket_id, channel_name } = req.body;

  const user = getUserFromSession(req);
  if (!user) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // No userData needed for private channels
  const authData = pingerchips.authenticate(socket_id, channel_name);
  res.json(authData);
});
```

### Presence Channel Example

```javascript
app.post('/auth', (req, res) => {
  const { socket_id, channel_name } = req.body;

  const user = getUserFromSession(req);
  if (!user) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Provide user data for presence
  const userData = {
    user_id: user.id,
    user_info: {
      name: user.name,
      avatar: user.avatar_url,
      online_status: 'active'
    }
  };

  const authData = pingerchips.authenticate(socket_id, channel_name, userData);
  res.json(authData);
});
```

## mTLS Support

For production deployments requiring mutual TLS authentication:

```javascript
import fs from 'fs';

const pingerchips = new PingerchipsServer('app_id', 'app_secret', {
  endpoint: 'https://pinger-processor.pingerchips.com/api',
  token: 'your-api-token',
  mtls: {
    enabled: true,
    cert: '/path/to/client-cert.pem',
    key: '/path/to/client-key.pem',
    ca: '/path/to/ca-cert.pem',
    rejectUnauthorized: true
  }
});
```

Or pass certificate content directly:

```javascript
const pingerchips = new PingerchipsServer('app_id', 'app_secret', {
  endpoint: 'https://pinger-processor.pingerchips.com/api',
  mtls: {
    enabled: true,
    cert: fs.readFileSync('/path/to/client-cert.pem', 'utf8'),
    key: fs.readFileSync('/path/to/client-key.pem', 'utf8'),
    ca: fs.readFileSync('/path/to/ca-cert.pem', 'utf8')
  }
});
```

## Complete Examples

### Express.js with Authentication

```javascript
import express from 'express';
import session from 'express-session';
import PingerchipsServer from 'pingerchips-js-server';

const app = express();
app.use(express.json());
app.use(session({ secret: 'your-secret', resave: false, saveUninitialized: true }));

const pingerchips = new PingerchipsServer(
  process.env.PINGERCHIPS_APP_ID,
  process.env.PINGERCHIPS_APP_SECRET,
  {
    appKey: process.env.PINGERCHIPS_APP_KEY,
    endpoint: 'https://pinger-processor.pingerchips.com/api',
    token: process.env.PINGERCHIPS_API_TOKEN
  }
);

// Auth endpoint for private/presence channels
app.post('/pingerchips/auth', (req, res) => {
  const { socket_id, channel_name, auth_info } = req.body;

  if (!req.session.user) {
    return res.status(403).json({ error: 'Not authenticated' });
  }

  const user = req.session.user;

  // Authorization logic
  if (channel_name.startsWith('private-user-')) {
    const userId = channel_name.replace('private-user-', '');
    if (user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  // User data for presence channels
  let userData = null;
  if (channel_name.startsWith('presence-')) {
    userData = {
      user_id: user.id,
      user_info: {
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    };
  }

  const authData = pingerchips.authenticate(socket_id, channel_name, userData);
  res.json(authData);
});

// Trigger events from your API routes
app.post('/api/orders/:orderId/shipped', async (req, res) => {
  const { orderId } = req.params;
  const order = await getOrder(orderId);

  // Notify the user
  await pingerchips.trigger(`private-user-${order.userId}`, 'order-update', {
    orderId,
    status: 'shipped',
    trackingNumber: order.trackingNumber
  });

  res.json({ success: true });
});

app.listen(3000);
```

### Next.js API Routes

```javascript
// pages/api/pingerchips/auth.js
import PingerchipsServer from 'pingerchips-js-server';
import { getSession } from 'next-auth/react';

const pingerchips = new PingerchipsServer(
  process.env.PINGERCHIPS_APP_ID,
  process.env.PINGERCHIPS_APP_SECRET,
  {
    appKey: process.env.PINGERCHIPS_APP_KEY,
    endpoint: process.env.PINGERCHIPS_ENDPOINT,
    token: process.env.PINGERCHIPS_API_TOKEN
  }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSession({ req });
  if (!session) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { socket_id, channel_name } = req.body;

  let userData = null;
  if (channel_name.startsWith('presence-')) {
    userData = {
      user_id: session.user.id,
      user_info: {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image
      }
    };
  }

  const authData = pingerchips.authenticate(socket_id, channel_name, userData);
  res.json(authData);
}
```

## Error Handling

Always handle errors when triggering events:

```javascript
try {
  await pingerchips.trigger('channel', 'event', { data: 'value' });
  console.log('Event triggered successfully');
} catch (error) {
  console.error('Failed to trigger event:', error.message);
  // Handle error appropriately
}
```

## Best Practices

1. **Store credentials securely** - Use environment variables for app ID, secret, and tokens
2. **Validate users** - Always verify user identity before authenticating channels
3. **Implement authorization** - Check if users have permission to access specific channels
4. **Handle errors** - Wrap trigger calls in try-catch blocks
5. **Rate limiting** - Implement rate limiting on your auth endpoint
6. **Sanitize data** - Validate and sanitize data before triggering events

## Next Steps

- Learn about [Client SDK](/docs/sdk/client-sdk) for receiving events
- Understand [Channel Types](/docs/sdk/channels) (public, private, presence)
- Explore [Pingerflows](/docs/tutorial-basics/getting-started) for event transformation
