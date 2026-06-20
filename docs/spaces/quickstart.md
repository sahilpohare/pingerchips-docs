---
sidebar_position: 2
---

# Quickstart

Add live cursors, member presence, and edit locks to a collaborative document in minutes.

---

## 1. Install

```bash
npm install pingerchips-js
```

---

## 2. Connect and join a space

```js
import { PingerchipsSpaces } from 'pingerchips-js/spaces';

const spaces = new PingerchipsSpaces('pk_live_...', {
  endpoint: 'wss://your-host/socket',
});

await spaces.connect();

const space = await spaces.get('doc-abc123', {
  clientId: 'user-42',
  profile: {
    name:   'Alice',
    color:  '#FF0099',
    avatar: 'https://example.com/alice.jpg',
  },
});

// Announce your presence
await space.enter({ name: 'Alice', color: '#FF0099' });
```

---

## 3. Live cursors

```js
// Publish your cursor position on mousemove
// Client-side throttled to ~30fps automatically
document.addEventListener('mousemove', (e) => {
  space.cursors.set({ x: e.clientX, y: e.clientY });
});

// Render other members' cursors
const off = space.cursors.subscribe('update', ({ member, position }) => {
  renderCursor(member.clientId, member.profile.color, position);
});
```

---

## 4. Member presence

```js
// Who is currently in the space?
const current = space.members.getAll();
current.forEach((m) => addAvatar(m));

// Subscribe to join/leave
space.members.subscribe('enter', (member) => {
  addAvatar(member);
  showToast(`${member.profile.name} joined`);
});

space.members.subscribe('leave', (member) => {
  removeAvatar(member.clientId);
});

space.members.subscribe('update', (member) => {
  updateAvatar(member);
});
```

---

## 5. Component locations

Show where each member is focused — great for "who's editing this block" indicators.

```js
// Set your location when the user focuses a block
function onBlockFocus(blockId) {
  space.locations.set({ elementId: blockId });
}

// Show other members' locations
space.locations.subscribe('update', ({ member, currentLocation, previousLocation }) => {
  if (previousLocation?.elementId) {
    clearLocationIndicator(previousLocation.elementId, member.clientId);
  }
  if (currentLocation?.elementId) {
    showLocationIndicator(currentLocation.elementId, member);
  }
});
```

---

## 6. Edit locks

Prevent two users from editing the same block simultaneously.

```js
// User clicks to edit a block
async function onEditClick(blockId) {
  try {
    await space.locks.acquire(blockId);
    enterEditMode(blockId);
  } catch (err) {
    const lock = space.locks.get(blockId);
    const holder = space.members.get(lock?.holder);
    showToast(`${holder?.profile.name ?? 'Someone'} is editing this block`);
  }
}

// User stops editing
async function onEditBlur(blockId) {
  await space.locks.release(blockId);
  exitEditMode(blockId);
}

// Show lock state for all blocks
space.locks.subscribe('update', ({ id, status, member }) => {
  setBlockLocked(id, status === 'locked' && member?.clientId !== myClientId);
});
```

---

## 7. Leave the space

```js
// On page unload or component unmount
await space.leave();
```

Leaving automatically releases all held locks and removes your presence from other members.

---

## React example

```jsx
import { useEffect, useState, useRef } from 'react';
import { PingerchipsSpaces } from 'pingerchips-js/spaces';

const spaces = new PingerchipsSpaces('pk_live_...');

function CollabDoc({ docId, user }) {
  const [members, setMembers] = useState([]);
  const spaceRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      await spaces.connect();
      const space = await spaces.get(docId, { clientId: user.id, profile: user });
      await space.enter(user);
      spaceRef.current = space;

      setMembers(space.members.getAll());

      const offEnter  = space.members.subscribe('enter',  () => setMembers(space.members.getAll()));
      const offLeave  = space.members.subscribe('leave',  () => setMembers(space.members.getAll()));
      const offUpdate = space.members.subscribe('update', () => setMembers(space.members.getAll()));

      return () => { offEnter(); offLeave(); offUpdate(); };
    })();

    return () => {
      mounted = false;
      spaceRef.current?.leave();
    };
  }, [docId, user.id]);

  return (
    <div>
      <AvatarStack members={members} />
      {/* rest of document */}
    </div>
  );
}
```

---

## What's next

- [SDK Reference](./sdk) — full `PingerchipsSpaces`, `Space`, `Cursors`, `Members`, `Locations`, `Locks` API
- [Architecture](./architecture) — EphemeralChannel, SpaceWorker, wire protocol
