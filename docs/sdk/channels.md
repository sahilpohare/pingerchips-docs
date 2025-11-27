---
sidebar_position: 3
---

# Channel Types

Pingerchips supports three types of channels, each with different access controls and features.

## Public Channels

Public channels can be subscribed to by anyone who knows the channel name. No authentication is required.

### When to Use

- Broadcasting announcements to all users
- Public chat rooms
- Live event updates
- Real-time dashboards
- News feeds

### Example

**Client:**
```javascript
const channel = await client.subscribe('announcements');

channel.bind('news', (data) => {
  console.log('Breaking news:', data.headline);
});
```

**Server:**
```javascript
await pingerchips.trigger('announcements', 'news', {
  headline: 'New Feature Released!',
  description: 'Check out our latest update',
  link: '/features/new'
});
```

### Best Practices

- Use descriptive channel names
- Don't send sensitive data over public channels
- Consider rate limiting to prevent spam
- Use events to categorize different types of messages

## Private Channels

Private channels require authentication. Only authenticated users can subscribe to these channels.

### When to Use

- User-specific notifications
- Private messaging
- Personalized data streams
- Secure communications

### Naming Convention

Private channel names **must** start with `private-`:

```javascript
'private-user-123'
'private-chat-room-456'
'private-order-updates'
```

### Example

**Client Setup:**
```javascript
const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://pinger-processor.pingerchips.com/socket',
  authEndpoint: 'https://your-app.com/auth',
  authInfo: {
    userId: '123',
    token: 'session-token'
  }
});

const channel = await client.subscribe('private-user-123');

channel.bind('notification', (data) => {
  console.log('You received:', data.message);
});
```

**Server (Auth Endpoint):**
```javascript
app.post('/auth', (req, res) => {
  const { socket_id, channel_name, auth_info } = req.body;

  // Verify user from session/token
  const user = verifyUser(auth_info.token);
  if (!user) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Check if user can access this specific channel
  if (channel_name === `private-user-${user.id}`) {
    const authData = pingerchips.authenticate(socket_id, channel_name);
    return res.json(authData);
  }

  return res.status(403).json({ error: 'Access denied' });
});
```

**Server (Triggering Events):**
```javascript
// Send notification to specific user
await pingerchips.trigger('private-user-123', 'notification', {
  message: 'Your order has shipped!',
  orderId: '789',
  trackingUrl: 'https://...'
});
```

### Security Considerations

1. **Always validate users** - Verify user identity before authenticating
2. **Implement authorization** - Check if user has permission to access the channel
3. **Use secure tokens** - Ensure auth tokens are secure and validated
4. **Never trust client data** - Validate channel access server-side

## Presence Channels

Presence channels combine private channel security with the ability to track who is currently subscribed.

### When to Use

- Chat applications (see who's online)
- Collaborative editors (see who's editing)
- Multiplayer games (see active players)
- Live events (see attendees)
- Status tracking (online/offline indicators)

### Naming Convention

Presence channel names **must** start with `presence-`:

```javascript
'presence-lobby'
'presence-chat-room-123'
'presence-document-456'
```

### Features

- Track all users subscribed to the channel
- Receive events when users join
- Receive events when users leave
- Attach custom user data (name, avatar, status, etc.)

### Example

**Client Setup:**
```javascript
const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://pinger-processor.pingerchips.com/socket',
  authEndpoint: 'https://your-app.com/auth',
  authInfo: {
    userId: '123',
    token: 'session-token'
  }
});

const channel = await client.subscribe('presence-lobby');

// Listen for users joining
channel.bind('user-joined', (data) => {
  console.log(`${data.user_info.name} joined`);
  console.log('User data:', data.user_info);
});

// Listen for users leaving
channel.bind('user-left', (data) => {
  console.log(`${data.user_info.name} left`);
});

// Send messages
channel.trigger('chat-message', {
  text: 'Hello everyone!'
});
```

**Server (Auth Endpoint):**
```javascript
app.post('/auth', (req, res) => {
  const { socket_id, channel_name, auth_info } = req.body;

  const user = verifyUser(auth_info.token);
  if (!user) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // For presence channels, provide user data
  const userData = {
    user_id: user.id,
    user_info: {
      name: user.name,
      email: user.email,
      avatar: user.avatarUrl,
      status: 'active',
      role: user.role
    }
  };

  const authData = pingerchips.authenticate(socket_id, channel_name, userData);
  res.json(authData);
});
```

**Server (Triggering Events):**
```javascript
// Broadcast to all users in the presence channel
await pingerchips.trigger('presence-lobby', 'announcement', {
  message: 'System maintenance in 5 minutes',
  type: 'warning'
});
```

### User Data Structure

When authenticating for presence channels, you must provide:

```javascript
{
  user_id: 'unique-user-id',  // Required: unique identifier
  user_info: {                // Optional: any custom data
    name: 'John Doe',
    email: 'john@example.com',
    avatar: 'https://...',
    // Any other custom fields
  }
}
```

:::note
The `user_id` is required and must be unique. The `user_info` object can contain any custom data you want to share with other users in the channel.
:::

## Channel Comparison

| Feature | Public | Private | Presence |
|---------|--------|---------|----------|
| Authentication Required | ❌ No | ✅ Yes | ✅ Yes |
| Track Subscribers | ❌ No | ❌ No | ✅ Yes |
| User Join/Leave Events | ❌ No | ❌ No | ✅ Yes |
| Custom User Data | ❌ No | ❌ No | ✅ Yes |
| Client-to-Client Events | ✅ Yes | ✅ Yes | ✅ Yes |
| Server-to-Client Events | ✅ Yes | ✅ Yes | ✅ Yes |
| Use Case | Public data | Private data | Collaborative features |

## Complete Examples

### Chat Application

```javascript
// Client-side
import Pingerchips from 'pingerchips-js';

const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://pinger-processor.pingerchips.com/socket',
  authEndpoint: 'https://your-app.com/auth',
  authInfo: {
    userId: currentUser.id,
    token: sessionToken
  }
});

// Join a chat room
const chatRoom = await client.subscribe('presence-room-123');

// Track online users
chatRoom.bind('user-joined', (data) => {
  addUserToList(data.user_info);
});

chatRoom.bind('user-left', (data) => {
  removeUserFromList(data.user_info);
});

// Receive messages
chatRoom.bind('message', (data) => {
  displayMessage(data);
});

// Send messages
function sendMessage(text) {
  chatRoom.trigger('message', {
    text,
    userId: currentUser.id,
    timestamp: Date.now()
  });
}
```

### Real-time Notifications

```javascript
// Server-side
import PingerchipsServer from 'pingerchips-js-server';

const pingerchips = new PingerchipsServer('APP_ID', 'APP_SECRET', {
  appKey: 'APP_KEY',
  endpoint: 'https://pinger-processor.pingerchips.com/api',
  token: 'API_TOKEN'
});

// Send notification to specific user
async function notifyUser(userId, notification) {
  await pingerchips.trigger(`private-user-${userId}`, 'notification', {
    title: notification.title,
    message: notification.message,
    type: notification.type,
    timestamp: Date.now()
  });
}

// Broadcast announcement to all users
async function broadcastAnnouncement(message) {
  await pingerchips.trigger('announcements', 'system-message', {
    message,
    priority: 'high',
    timestamp: Date.now()
  });
}
```

## Best Practices

### Channel Naming

- Use descriptive names: `presence-chat-room-123` instead of `pr-123`
- Include context: `private-user-orders-123` instead of `private-123`
- Use consistent naming patterns across your app

### Security

- **Never trust client data** - Always validate on the server
- **Implement proper authorization** - Don't just authenticate, authorize access
- **Sanitize user data** - Validate and clean data before broadcasting
- **Use HTTPS** - Ensure your auth endpoint uses HTTPS

### Performance

- **Unsubscribe when done** - Clean up channels when users navigate away
- **Batch messages** - Combine multiple updates into single events when possible
- **Rate limit** - Prevent users from spamming channels

### Error Handling

```javascript
try {
  const channel = await client.subscribe('presence-room');
  channel.bind('message', handleMessage);
} catch (error) {
  console.error('Failed to subscribe:', error);
  // Show error to user
}
```

## Next Steps

- Set up [Client SDK](/docs/sdk/client-sdk) in your application
- Configure [Server SDK](/docs/sdk/server-sdk) for triggering events
- Implement authentication with your backend
- Explore [Pingerflows](/docs/tutorial-basics/getting-started) for event transformation
