---
sidebar_position: 3
---

# SDK Reference

```js
import { PingerchipsSpaces } from 'pingerchips-js/spaces';
```

---

## PingerchipsSpaces

The root client. Creates and manages Spaces.

### Constructor

```ts
new PingerchipsSpaces(appKey: string, options?: SpacesOptions)
```

| Option | Type | Description |
|---|---|---|
| `endpoint` | string | WebSocket host. Defaults to `wss://queue.pingerchips.com/socket` in production. |
| `realtime` | Pingerchips | Pass an existing `Pingerchips` instance to share the socket connection. |

### `connect(): Promise<void>`

Waits until the socket is connected. Call before `get`.

```js
await spaces.connect();
```

### `get(spaceId, options): Promise<Space>`

Joins or returns a cached Space.

```ts
get(spaceId: string, options: {
  clientId: string;
  profile?:  object;   // arbitrary member metadata
  throttle?: number;   // cursor throttle in ms (default: 33 ≈ 30fps)
}) => Promise<Space>
```

```js
const space = await spaces.get('doc-abc123', {
  clientId: 'user-42',
  profile: { name: 'Alice', color: '#FF0099' },
});
```

### `leave(spaceId): void`

Leaves and cleans up the space. Equivalent to `space.leave()`.

---

## Space

Obtained from `spaces.get(...)`.

### Properties

| Property | Type | Description |
|---|---|---|
| `spaceId` | string | The space identifier |
| `clientId` | string | This member's client ID |
| `profile` | object | This member's profile |
| `cursors` | Cursors | Cursor sub-API |
| `members` | Members | Member presence sub-API |
| `locations` | Locations | Location sub-API |
| `locks` | Locks | Lock sub-API |

### `enter(profile?): Promise<void>`

Announces presence to all space members. Can be called after `get` to update your profile.

```js
await space.enter({ name: 'Alice', color: '#FF0099', avatar: 'https://...' });
```

### `leave(): Promise<void>`

Removes your presence, releases all held locks, and leaves the channel.

---

## Cursors

`space.cursors`

### `set(position): void`

Publishes your current cursor position. Client-side throttled to the `throttle` interval (default 33ms / ~30fps). Calling `set` more frequently than the throttle drops intermediate positions — only the latest position is sent per interval.

```ts
set(position: { x: number; y: number; [key: string]: any }) => void
```

```js
space.cursors.set({ x: 124, y: 88 });

// With extra metadata
space.cursors.set({ x: 124, y: 88, tool: 'pen' });
```

### `subscribe(event, handler): () => void`

Subscribe to cursor updates from other members. Returns an unsubscribe function.

```ts
subscribe('update', (payload: {
  member:   Member;
  position: { x: number; y: number; [key: string]: any };
}) => void) => () => void
```

```js
const off = space.cursors.subscribe('update', ({ member, position }) => {
  renderCursor(member.clientId, position);
});

// Cleanup
off();
```

Note: your own cursor events are filtered out — you only receive other members' cursors.

---

## Members

`space.members`

### `getAll(): Member[]`

Returns all currently connected members, including yourself.

```js
const members = space.members.getAll();
```

### `get(clientId): Member | undefined`

Returns a specific member by `clientId`.

```js
const alice = space.members.get('user-42');
```

### `subscribe(event, handler): () => void`

Subscribe to member lifecycle events. Returns an unsubscribe function.

```ts
subscribe(
  event:   'enter' | 'leave' | 'update',
  handler: (member: Member) => void
) => () => void
```

| Event | When |
|---|---|
| `enter` | A new member joins the space |
| `leave` | A member leaves or disconnects |
| `update` | A member updates their profile (via `enter()` again) |

```js
const offEnter = space.members.subscribe('enter', (member) => {
  console.log(`${member.profile.name} joined`);
  addAvatar(member);
});

const offLeave = space.members.subscribe('leave', (member) => {
  removeAvatar(member.clientId);
});
```

### Member shape

```ts
interface Member {
  clientId: string;
  profile:  object;     // whatever was passed to enter()
  joinedAt: number | null;
}
```

---

## Locations

`space.locations`

### `set(location): void`

Publishes your current location to all other members. No throttling — call this on focus/selection change events (which are inherently low-frequency).

```ts
set(location: object) => void
```

```js
// Document editor: user focuses a block
space.locations.set({ elementId: 'block-3' });

// Text editor: user selects a range
space.locations.set({ elementId: 'heading-2', range: { start: 4, end: 12 } });

// Spreadsheet: user focuses a cell
space.locations.set({ row: 5, col: 3 });
```

### `subscribe(event, handler): () => void`

Subscribe to location updates from other members.

```ts
subscribe('update', (payload: {
  member:           Member;
  currentLocation:  object;
  previousLocation: object | null;
}) => void) => () => void
```

```js
space.locations.subscribe('update', ({ member, currentLocation, previousLocation }) => {
  if (previousLocation?.elementId) {
    clearIndicator(previousLocation.elementId, member.clientId);
  }
  if (currentLocation?.elementId) {
    showIndicator(currentLocation.elementId, member);
  }
});
```

Own location events are filtered out.

---

## Locks

`space.locks`

Locks are ephemeral distributed mutexes. They are serialised server-side — only one member can hold a named lock at a time.

### `acquire(lockId): Promise<{ id: string, status: 'locked' }>`

Attempts to acquire the named lock. Resolves if successful, rejects if the lock is held by another member.

```js
try {
  const lock = await space.locks.acquire('block-3');
  // { id: 'block-3', status: 'locked' }
  enterEditMode('block-3');
} catch (err) {
  // err.message: "lock held by another member"
  showConflictUI('block-3');
}
```

Acquiring a lock you already hold is idempotent — it resolves immediately without error.

### `release(lockId): Promise<void>`

Releases the named lock. If you do not hold the lock, resolves silently.

```js
await space.locks.release('block-3');
exitEditMode('block-3');
```

### `get(lockId): object | undefined`

Returns the current local state of a lock.

```ts
{ id: string; status: 'locked'; holder: string } | undefined
```

```js
const lock = space.locks.get('block-3');
if (lock) {
  const holder = space.members.get(lock.holder);
  console.log(`Held by ${holder?.profile.name}`);
}
```

### `getAll(): object[]`

Returns all currently held locks.

### `subscribe(event, handler): () => void`

Subscribe to lock state changes.

```ts
subscribe('update', (payload: {
  id:     string;
  status: 'locked' | 'unlocked';
  member: Member | null;  // null when unlocked
}) => void) => () => void
```

```js
const myClientId = space.clientId;

space.locks.subscribe('update', ({ id, status, member }) => {
  const lockedByOther = status === 'locked' && member?.clientId !== myClientId;
  setBlockEditable(id, !lockedByOther);
});
```

### Automatic lock release on disconnect

When a member disconnects, the server automatically releases all locks they hold and broadcasts `lock:update` events with `status: "unlocked"`. Your `subscribe('update')` handler fires exactly as if the member had explicitly called `release()`.

---

## Types

```ts
interface Member {
  clientId: string;
  profile:  Record<string, any>;
  joinedAt: number | null;
}

interface CursorPosition {
  x: number;
  y: number;
  [key: string]: any;
}

interface Lock {
  id:     string;
  status: 'locked';
  holder: string;  // clientId of the holder
}
```
