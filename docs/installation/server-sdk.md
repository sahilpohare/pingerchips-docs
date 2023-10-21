---
sidebar_position: 1
---

# Setup Server SDK

Let's setup the Pingerchips Server SDK.
You can use any [Pusher Server SDK](https://pusher.com/docs/channels/channels_libraries/libraries/) to connect to Pingerchips.

We will be using [Pusher NodeJS SDK](https://www.npmjs.com/package/pusher)

## Installation

```bash
npm install pusher
```

## Usage

```js
const Pusher = require("pusher");

const pusher = new Pusher({
    secret: "<APP SECRET>",
    appId: "<APP ID>",
    host: "ws.pingerchips.com",
    port: 6001,
    key: "<APP KEY>",
    useTLS: false,
});

const out = await pusher.trigger("my-channel", "my-event", "hello");
if (!out.ok) {
    console.log("FAILED TO SEND");
}
```
