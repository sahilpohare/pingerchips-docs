---
sidebar_position: 1
---

# Client SDK (JavaScript)

The Pingerchips JavaScript SDK allows you to receive real-time events in your web or Node.js applications.

## Installation

```bash
npm install pingerchips-js
```

## Quick Start

```javascript
import Pingerchips from 'pingerchips-js';

// Initialize the client
const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://pinger-processor.pingerchips.com/socket'
});

// Subscribe to a channel
const channel = await client.subscribe('lobby');

// Listen for events
channel.bind('message', (data) => {
  console.log('Received message:', data);
});

// Send events
channel.trigger('message', { text: 'Hello World!' });
```

## Configuration Options

When initializing Pingerchips, you can provide the following options:

| Option | Type | Description | Required |
|--------|------|-------------|----------|
| `endpoint` | string | WebSocket endpoint URL | Yes |
| `authEndpoint` | string | Your server's auth endpoint for private/presence channels | No |
| `authInfo` | object | User authentication info passed to your auth endpoint | No |
| `authHeaders` | object | Additional headers for auth requests | No |
| `params` | object | Additional query parameters for the connection | No |

### Example with Authentication

```javascript
const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://pinger-processor.pingerchips.com/socket',
  authEndpoint: 'https://your-server.com/auth',
  authInfo: {
    userId: '123',
    token: 'user-session-token'
  },
  authHeaders: {
    'Authorization': 'Bearer your-token'
  }
});
```

## Subscribing to Channels

### Public Channels

Public channels can be subscribed to by anyone:

```javascript
const channel = await client.subscribe('lobby');
```

### Private Channels

Private channels require authentication and must be prefixed with `private-`:

```javascript
const channel = await client.subscribe('private-chat-room');
```

:::note
You must configure an `authEndpoint` to use private channels. See the [Server SDK Authentication](/docs/sdk/server-sdk#authentication) guide for details on setting up your auth endpoint.
:::

### Presence Channels

Presence channels track who is subscribed and must be prefixed with `presence-`:

```javascript
const channel = await client.subscribe('presence-lobby');

channel.bind('user-joined', (data) => {
  console.log('User joined:', data.user_info);
});

channel.bind('user-left', (data) => {
  console.log('User left:', data.user_info);
});
```

## Channel Methods

### `bind(event, callback)`

Listen for events on a channel:

```javascript
channel.bind('message', (data) => {
  console.log('Received:', data);
});

channel.bind('user-update', (data) => {
  console.log('User updated:', data);
});
```

### `trigger(event, data)`

Send an event to a channel (client-to-client events):

```javascript
channel.trigger('typing', {
  user: 'John',
  isTyping: true
});
```

### `unbind(event)`

Stop listening for an event:

```javascript
channel.unbind('message');
```

### `leave()`

Unsubscribe from a channel:

```javascript
channel.leave();
```

## Unsubscribing from Channels

```javascript
// Using the client
client.unsubscribe('lobby');

// Or using the channel wrapper
channel.leave();
```

## Connection Events

Monitor connection status:

```javascript
const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://pinger-processor.pingerchips.com/socket'
});

// Connection will automatically establish
// Check client.socket for connection status
```

## Complete Example

```javascript
import Pingerchips from 'pingerchips-js';

// Initialize
const client = new Pingerchips('YOUR_APP_KEY', {
  endpoint: 'wss://pinger-processor.pingerchips.com/socket',
  authEndpoint: 'https://your-app.com/auth',
  authInfo: {
    userId: '123',
    token: 'session-token'
  }
});

// Subscribe to a public channel
const publicChannel = await client.subscribe('announcements');
publicChannel.bind('announcement', (data) => {
  console.log('New announcement:', data.message);
});

// Subscribe to a private channel
const privateChannel = await client.subscribe('private-user-123');
privateChannel.bind('notification', (data) => {
  console.log('Private notification:', data);
});

// Subscribe to a presence channel
const presenceChannel = await client.subscribe('presence-room');

presenceChannel.bind('user-joined', (data) => {
  console.log(`${data.user_info.name} joined the room`);
});

presenceChannel.bind('user-left', (data) => {
  console.log(`${data.user_info.name} left the room`);
});

// Send a message
presenceChannel.trigger('chat-message', {
  text: 'Hello everyone!',
  timestamp: Date.now()
});

// Cleanup when done
// publicChannel.leave();
// privateChannel.leave();
// presenceChannel.leave();
```

## Using with React

```jsx
import { useEffect, useState } from 'react';
import Pingerchips from 'pingerchips-js';

function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [client, setClient] = useState(null);
  const [channel, setChannel] = useState(null);

  useEffect(() => {
    // Initialize Pingerchips
    const pingerchips = new Pingerchips('YOUR_APP_KEY', {
      endpoint: 'wss://pinger-processor.pingerchips.com/socket'
    });

    setClient(pingerchips);

    // Subscribe to channel
    pingerchips.subscribe('chat').then(ch => {
      setChannel(ch);

      ch.bind('message', (data) => {
        setMessages(prev => [...prev, data]);
      });
    });

    // Cleanup
    return () => {
      if (channel) channel.leave();
    };
  }, []);

  const sendMessage = (text) => {
    if (channel) {
      channel.trigger('message', { text, timestamp: Date.now() });
    }
  };

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.text}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

## Browser Support

The SDK works in all modern browsers that support WebSockets:
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Next Steps

- Learn about [Server SDK](/docs/sdk/server-sdk) for triggering events from your backend
- Set up [Authentication](/docs/sdk/server-sdk#authentication) for private and presence channels
- Explore [Pingerflows](/docs/tutorial-basics/getting-started) to transform events
