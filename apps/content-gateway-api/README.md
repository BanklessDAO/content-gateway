# Content Gateway API

This is the API part of the _Content Gateway_.

> 📗 If you want to work on the codebase read the quick guide [here](../../README.md).

The **production** version of _Content Gateway_ is available [here](https://prod-content-gateway-api.herokuapp.com/).

If you'd like to integrate your project with the API this is the URL you'd want to use. If you want to learn how to create a _data loader_ then go [here](../content-gateway-loader/README.md).

If you'd like to _consume_ data, then read on.

_Content Gateway_ (CG for short) comes with some useful endpoints. All endpoints are also versioned, so you can safely use them, they won't break.

## Current Version (V1)

-   **GraphQL**

    -   🟢 **GET** [https://prod-content-gateway-api.herokuapp.com/api/v1/graphql](https://prod-content-gateway-api.herokuapp.com/api/v1/graphql): This is a visual GraphQL editor. Use this to explore the data that we have in CG, and also to create queries that you can later copy to your application. All the API documentation for the data itself also resides here.

    -   🔵 **POST** [https://prod-content-gateway-api.herokuapp.com/api/v1/graphql](https://prod-content-gateway-api.herokuapp.com/api/v1/graphql): The same GraphQL endpoint but this is for programmatic access.

-   **Schema**
    -   🔵 **POST** a _Schema_ [https://prod-content-gateway-api.herokuapp.com/api/v1/rest/schema/](https://prod-content-gateway-api.herokuapp.com/api/v1/rest/schema): You can create (register) a schema with this endpoint. You probably won't need this as the _SDK_ uses this endpoint internally.
    -   🔴 **DELETE** a _Schema_ [https://prod-content-gateway-api.herokuapp.com/api/v1/rest/schema/](https://prod-content-gateway-api.herokuapp.com/api/v1/rest/schema/): You can remove a schema with this endpoint. Only use this if you messed something up and you'd like to delete all data. The endpoint accepts the `SchemaInfo` as a json, eg:
    ```json
    {
        "namespace": "poap",
        "name": "POAPTransfer",
        "version": "V1"
    }
    ```
-   **Data**
    -   🔵 **POST** a _Data_ payload [https://prod-content-gateway-api.herokuapp.com/api/v1/rest/data/receive/](https://prod-content-gateway-api.herokuapp.com/api/v1/rest/data/receive/): Sends a payload with a single _data_ entry. You probably won't need this as the _SDK_ uses this endpoint internally.
    -   🔵 **POST** a __batch__ _Data_ payload [https://prod-content-gateway-api.herokuapp.com/api/v1/rest/data/receive-batch/](https://prod-content-gateway-api.herokuapp.com/api/v1/rest/data/receive-batch/): Sends a __batch__ payload with multiple _data_ entries. You probably won't need this as the _SDK_ uses this endpoint internally. 
-   **Utility**
    -   🟢 **GET** _Stats_ [https://prod-content-gateway-api.herokuapp.com/api/v1/rest/schema/stats](https://prod-content-gateway-api.herokuapp.com/api/v1/rest/schema/stats): Here you can access useful statistics about the data in CG.
