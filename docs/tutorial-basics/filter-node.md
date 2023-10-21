---
sidebar_position: 2
---

# Filter Node

The filter node is a node that allows you to filter the data that is being sent to your clients. You can use it to filter out events that you don't want your clients to receive.

## Properties

`filter` A JSON object that contains the filter conditions.
It is written in the MongoDB query language.

### Example

The following example will filter out all events that have the name "John Doe".

```json
{
    "name": {
        "$in": ["John Doe", "Jane Doe"]
    }
}
```

### Allowed Operators

-   $eq
-   $gt
-   $gte
-   $in
-   $lt
-   $lte
-   $ne
-   $nin
-   $and
-   $not
-   $nor
-   $or

For more information on the operators, please refer to the [MongoDB documentation](https://docs.mongodb.com/manual/reference/operator/query/).

### Limitations

-   Aggregation queries are not allowed.
-   Joins are not allowed.
