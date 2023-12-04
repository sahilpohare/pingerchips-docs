---
sidebar_position: 2
---

# Client SDK Setup

You can use any [Pusher Client SDK](https://pusher.com/docs/channels/channels_libraries/libraries/) to connect to Pingerchips.
We will be using [Pusher JS](https://github.com/pusher/pusher-js?_gl=1*wjq8zd*_gcl_au*MTY2MTcxMTY3NC4xNjk1NzU0NTUz) for this example.

## Installation

:::note

You can skip this step if you already have the Pusher JS SDK installed in your project

```bash
npm install pusher-js
```

## Usage

```js
import Pingerchips from "pingerchips-js";

let pingerchips = new Pingerchips(<APP KEY>, {
    wsHost: "ws.pingerchips.com",
    wsPort: 6001,
    forceTLS: false,
    encrypted: true,
    disableStats: true,
    enabledTransports: ["ws", "wss"],
    cluster: "mt1",
});

let channel = pingerchips.subscribe("my-channel");
channel.bind("my-event", function (data) {
    alert("Received my-event with message: " + data.message);
});
```
