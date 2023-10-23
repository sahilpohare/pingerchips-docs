---
sidebar_position: 1
---

# Transform Node

The transform node is a node that allows you to transform the data that is being sent to your clients. You can use it to add additional data to your events, or to modify the data in your events.

### Properties

`transformer`

-   A javascript function that takes in the data and returns the transformed data.

    :::note
    The transformer function must be a default export.
    :::

### Example

```js
export default function transformer(message) {
    return {
        ...message,
        newKey: "newValue",
    };
}
```

### Limitations

-   The runtime for the transformer function is limited to 1 second and 8 mb memory.
-   The transformer function must be a pure function.
-   fetch, XMLHttpRequest, and other network requests are not allowed along with other side effects.
