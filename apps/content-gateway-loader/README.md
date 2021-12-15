# Content Gateway Loader

This application implements the _pull_ loading model for the [Content Gateway](../../README.md).

If you want to implement a custom loader read on. If you're not sure what you're looking for go to the [root directory](../../README.md) of this project and read the guide.

## Loading Data

This project is all about getting data from an external data source into the _Content Gateway_.

In order to do this we're going to write `DataLoader`s. Let's take a look at how a `DataLoader` works:

```ts
export type InitContext = {
    client: ContentGatewayClientV1;
    jobScheduler: JobScheduler;
    jobRepository: JobRepository;
};

export type LoadContext = {
    cursor?: string;
    limit: number;
};

export type LoadingResult<T> = {
    data: T[];
    cursor: string;
};

export type SaveContext<T> = {
    currentJob: Job;
    client: ContentGatewayClientV1;
    jobScheduler: JobScheduler;
    loadingResult: LoadingResult<T>;
};

export interface DataLoader<T> {
    info: SchemaInfo;
    initialize: (deps: InitContext) => TE.TaskEither<ProgramError, void>;
    load: (deps: LoadContext) => TE.TaskEither<ProgramError, LoadingResult<T>>;
    save: (
        deps: SaveContext<T>
    ) => TE.TaskEither<ProgramError, JobDescriptor | undefined>;
}
```

Each loader works with a specific _schema_ (this is what we represent by the `info: SchemaInfo` property). When a loader is created `initialize` will be called.

In this function you'll have access to the `ContentGatewayClient` (to register your data structures) and the `JobScheduler` (to schedule jobs).

Whenever a scheduled job runs `load` will be called. This function is responsible for loading data from the external data source using the given `cursor` and `limit`.

> 📗 A `cursor` is an opaque string that represents where we "left off" after the last loading. More on this later.

After `load` returns `save` is called. This function is responsible for deciding what to do with the data that was `load`ed (usually it sends the data to _Content Gateway_).

Note that you don't have to schedule the next run of this job yourself, you just have to return a new `JobDescriptor` if you want to run the same loader again (which you probably want).

This construct is useful for throttling: you can decide after each run when to run the next one. The `JobDescriptor` is very simple:

```ts
export type JobDescriptor = {
    readonly info: SchemaInfo;
    readonly scheduledAt: Date;
    readonly scheduleMode: ScheduleMode;
    readonly cursor: string;
    readonly limit: number;
};
```

`info` contains the schema information.
`scheduledAt` is the next time when the loader should run.
`scheduleMode` can be either `BACKFILL` or `INCREMENTAL`.

> 📗 `BACKFILL` means that the loader is loading all the data from the beginning. Conversely, `INCREMENTAL` is only loading new data. This construct allows you to have different _cadence_ depending on whether the data is up to date or not.

The cursor is an arbitrary number (usually a timestamp or a sequential id) that represents the point where we "left off" since the last batch was loaded. You can use this construct to continue loading data if for example the data set is too big and it would be unfeasible to load it in one go. Another use case is when the data source is updated periodically and you want to remember when was the last update on your part. More info about cursors [here](http://mysql.rjweb.org/doc.php/pagination).

### Writing a Loader

Now let's take a look at how a loader can be implemented.

Loaders reside _(for now)_ in the `libs/domain/feature-loaders` folder. For each loader you'll have to consider what namespace to use. For example if you want to write a loader for loading POAPs it would make sense ot create a `poap-token` folder.

In this exmple we're going to write a simple integration for loading \_Bankless Token Account_s.

Since we're going to send data to the _Content Gateway_ we need to declare the structure of the data that we're sending:

```ts
import { Data, NonEmptyProperty } from "@shared/util-schema";

const INFO = {
    namespace: "bankless-token",
    name: "Account",
    version: "V1",
};

@Data({
    info: INFO,
})
class Account {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    balance: string;
    @NonEmptyProperty()
    lastTransactionExecutedAt: string;
}
```

> 📗 Note that we're using decorators from the `@shared/util-schema` package.

For every type you want to send to _Content Gateway_ (CG for short) you'll need to create a `class` and add metadata using decorators to it.

For the "root" type you'll have to use `@Data` witht he `SchemaInfo` object (namespace, name, version.)

There are a bunch of decorators you can use depending on what kind of data you're working with.

For **primitive values** you can use `@Property`. `@Property` accepts an object that you can use
to parameterize it:

```ts
export type PropertyParams = {
    required: Required;
};
```

`Required` has `3` options:

```ts
export const Required = {
    /**
     * The field is required to be present but can be empty (eg: `""`)
     */
    REQUIRED: "REQUIRED",
    /**
     * The value of the field can be `undefined` or `null`.
     */
    OPTIONAL: "OPTIONAL",
    /**
     * The field is required to be present and must not be empty. (eg: `"foo"`)
     */
    NON_EMPTY: "NON_EMPTY",
} as const;
```

If you don't want to type much you can just use the shorthand decorators instead:

-   `@NonEmptyProperty`
-   `@RequiredProperty`
-   `@OptionalProperty`

> 📙 Note that `@Property` only works with **primitive** values. `boolean`, `string` and `number` are supported.

If you want to nest arrays or composite data structures you'll have to use `@ArrayRef`, `@ObjectRef` or `@ArrayOf`:

`@ArrayOf` is for primitive arrays:

```ts
@ArrayOf({
    required: Required.REQUIRED,
    type: "string",
})
answers: string[];
```

This also has shorthands:

-   `@RequiredStringArrayOf`
-   `@RequiredNumberArrayOf`
-   `@RequiredBooleanArrayOf`
-   `@OptionalStringArrayOf`
-   `@OptionalNumberArrayOf`
-   `@OptionalBooleanArrayOf`

`@ObjectRef` is for composite objects:

```ts
@ObjectRef({
    type: DiscordUser,
    required: Required.REQUIRED,
})
claimedBy?: DiscordUser;
```

The shorthands are:

-   `@RequiredObjectRef(DiscordUser)`
-   `@OptionalObjectRef(DiscordUser)`

Finally, `@ArrayRef` is for arrays holding composite objects:

```ts
@ArrayRef({
    type: Comment,
    required: Required.REQUIRED,
})
comments: Comment[];
```

with the following shorthands:

-   `@RequiredArrayRef(Comment)`
-   `@OptionalArrayRef(Comment)`

Now that we know how to decorate our types let's start coding...

If you want to log stuff you can use `tslog`:

```ts
import { createLogger } from "@shared/util-fp";

const logger = createLogger("MyLogger");
```

> 📗 Note that we're using fp-ts extensively. This is a library that implements functional programming constructs for Typescript. Take a look at the list of introductory material [here](../../README.md#a-note-on-fp-ts) if you're not familiar with it.

Now that we know what we want to **send** to CG, let's consider how we want to **load** it.

In our case we'll use a _TheGraph_ endpoint:

```ts
const URL = "https://api.thegraph.com/subgraphs/name/0xnshuman/bank-subgraph";
```

with the following _GraphQL_ query:

```ts
import gql from "graphql-tag";
import { DocumentNode } from "graphql";

const QUERY: DocumentNode = gql`
    query banklessTokenAccounts($limit: Int, $cursor: String) {
        accounts(
            first: $limit
            orderBy: lastTransactionTimestamp
            where: { lastTransactionTimestamp_gt: $cursor }
        ) {
            id
            ERC20balances {
                id
                value
            }
            lastTransactionTimestamp
        }
    }
`;
```

Decoding the data from a request into an object can be a bit tricky, but thankfully we have a library that can do it properly: [io-ts](https://github.com/gcanti/io-ts/blob/master/index.md).

> 📗 Feel free to refer to [their guide](https://github.com/gcanti/io-ts/blob/master/index.md) if you're not familiar with it.

> 📙 Note that you're free to implement a `DataLoader` in any way you see fit, but we've created some tooling around it using specific libraries outlined below. 👇

Let's create some _codecs_ that represent the shape of data that we'll _receive_ from the endpoint:

```ts
import { withMessage } from "io-ts-types";
import * as t from "io-ts";

const ERC20balanceCodec = t.strict({
    id: withMessage(t.string, () => "id is required"),
    value: withMessage(t.string, () => "value is required"),
});

const BANKAccountCodec = t.strict({
    id: withMessage(t.string, () => "id is required"),
    ERC20balances: withMessage(
        t.array(ERC20balanceCodec),
        () => "ERC20balances is required"
    ),
    lastTransactionTimestamp: withMessage(
        t.string,
        () => "lastTransactionTimestamp is required"
    ),
});

const BANKAccountsCodec = t.strict({
    accounts: t.array(BANKAccountCodec),
});
```

Here:

- `t.strict` defines an object that has a bunch of properties. There is also `t.type` but `t.strict` will not allow additional properties (will simply strip them). This is useful form a security perscpective.
- You can wrap any definition with `t.withMessage`. It will give you useful error messages in case the data validation fails.
- `t.array` defines arrays, and you can use `t.string`, `t.number` and `t.boolean` for primitive types.

What's interesting about `io-ts` is that it can generate regular `type`s from these codecs:

```ts
type BANKAccounts = t.TypeOf<typeof BANKAccountsCodec>;
```

👀

Ok, now that we have defined the metadata that's necessary for creating a loader let's add the actual loading code. CG comes with a few loader base classes that we can take advantage of:

- `GraphQLDataLoaderBase` will create a GraphQL loader and
- `HTTPDataLoaderBase` will help with loading data from HTTP endpoints.

We're gonna use `GraphQLDataLoaderBase` in this case:

```ts
import { GraphQLDataLoaderBase } from "../base/GraphQLDataLoaderBase";

export class BANKAccountLoader extends GraphQLDataLoaderBase<
    BANKAccounts,
    Account
> {

}
```

`BANKAccountLoader` accepts `2` type parameters: The first is the type of the data that we __consume__, the second is the type we __send__.

Now let's add the missing properties:

```ts
import { BATCH_SIZE } from "..";
import { ScheduleMode } from "@shared/util-loaders";
import { GraphQLClient } from "@shared/util-data";

export class BANKAccountLoader extends GraphQLDataLoaderBase<
    BANKAccounts,
    Account
> {
    // 1
    public info = INFO;
    // 2
    protected batchSize = BATCH_SIZE;
    // 3
    protected type = Account;
    // 4
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    // 5
    protected graphQLQuery: DocumentNode = QUERY;
    // 6
    protected codec = BANKAccountsCodec;

    // 7
    constructor(client: GraphQLClient) {
        super(client);
    }
}
```

Here we:

1. set the `info` field to the `INFO` we created before
2. set the `batchSize` field to the default `BATCH_SIZE` value (`1000`). This is the amount of records we want to load in one request.
3. set the `type` to the `class` we defined earlier
4. set the `cadenceConfig` so that it would execute the lodader every `5` seconds while we're `BACKFILL`ing and every `5` minutes after we've loaded all historical data.
5. Since this is a GraphQL loader, we can supply the `QUERY` object we created earlier to the `graphQLQuery` field.
6. The loader uses `io-ts` internally, so it needs a codec to decode the data that comes from the endpoint.
7. We also have to supply a `GraphQLClient` to the parent constructor, but we're going to defer creating it to the caller (dependency injection).

Now you'll still see some compiler errors in your code because we haven't implemented some functions that are required by the base class. First let's take a look at `mapResult`:

```ts
import { notEmpty } from "@shared/util-fp";

protected mapResult(accounts: BANKAccounts): Array<Account> {
    return accounts.accounts
        .map((account) => {
            let balance = "0";
            if (account.ERC20balances.length > 0) {
                balance = account.ERC20balances[0].value;
            }
            return {
                id: account.id,
                balance: balance,
                lastTransactionExecutedAt: account.lastTransactionTimestamp,
            };
        })
        .filter(notEmpty);
}
```

> 📗 `notEmpty` is just a type guard that ensures that the value is not `null` or `undefined`

As you can see in this function our job is to turn the data that we received (`BANKAccounts`) to the shape that we want to save (`Account`). 

Finally  we'll have to implement `extractCursor`. This takes the data we loaded and tries to figure out how to save the "left off" value (cursor) for the next request:

```ts
import { DEFAULT_CURSOR } from "@shared/util-loaders";

protected extractCursor(accounts: BANKAccounts) {
    const obj = accounts.accounts;
    if (obj.length === 0) {
        return DEFAULT_CURSOR;
    }
    return `${obj[obj.length - 1].lastTransactionTimestamp}`;
}
```

This is a _best effort_ implementation that will return the `lastTransactionTimestamp` if there are any records in the `accounts` array. If there are no records, it will return the default `DEFAULT_CURSOR` value (`"0"`).

Now let's take a look at how all of this works: when the loader is `initialize`d the base class will wire together all the metadtata we provided (cocec, type, etc).

Then when load is called it will use our `query` and `mapResult` implementation to map the results that we received.

Finally, it will decide what to do next based on whether we have a cursor or not.

Good job! 🎈

You've created your first loader!

### Notes on Loading

You might have noticed that the GraphQL query we created orders the data by `lastTransactionTimestamp` and we extract the cursor using the same field:

```
orderBy: lastTransactionTimestamp
```

```ts
return `${obj[obj.length - 1].lastTransactionTimestamp}`;
```

This is not a coincidence. What you usually want to do is to figure out what field (and how) can you use to order the data and use as a cursor. This field needs to be unique too, otherwise
you can miss some records.

If you want to use a HTTP loader, take a look at the other loaders in this package.

If you have any questions, feel free to ask in the #content-gateway channel on the Bankless DAO Discord server.

### Testing


> 📕 **Note that** this section is a **work in progress**! Check back later to see a full example for testing.

If you want to know whether your loader works properly without having to go through the build -> deploy -> check workflow you can write a unit test instead. We're using standard tools including [Jest](https://jestjs.io/) for unit testing and [Cypress](https://www.cypress.io/) for end-to-end testing. For integration testing we use [Supertest](https://www.npmjs.com/package/supertest).

Let's take a look at how we can test the `Loader` we just created.

The convention is to put the unit test next to the file but with a `.spec` infix. For example for `ExampleLoader.ts` we'll create `ExampleLoader.spec.ts`.

Creating a test starts with describing it:

> Note that no import is needed here

```ts
describe("Given an example loader", () => {});
```

Within the `describe` call we can add the actual tests using `it`:

```ts
describe("Given an example loader", () => {
    it("When initialize is called Then it runs successfully", () => {});
});
```

Now we can start testing.

Let's see how we can write the test for `initialize`. We're going to use the stub client and the stub scheduler that we provide. We're also going to add a function that
re-initializes the stub before each test:

```ts
import { exampleLoader } from "./ExampleLoader";
import {
    createStubClient,
    StubClientObjects,
} from "@banklessdao/content-gateway-sdk";
import { createJobSchedulerStub, JobSchedulerStub } from "..";

describe("Given an example loader", () => {
    const loader = exampleLoader;

    let clientStub: StubClientObjects;
    let jobSchedulerStub: JobSchedulerStub;

    beforeEach(() => {
        clientStub = createStubClient();
        jobSchedulerStub = createJobSchedulerStub();
    });

    //                                     async is only supported in `it` 👇
    it("When initialize is called Then it runs successfully", async () => {
        // we await the promise 👇
        const result = await loader.initialize({
            client: clientStub.client,
            jobScheduler: jobSchedulerStub,
        })(); // 👈 note the `()`. This means that we invoke the `TaskEither` to turn it into a `Promise<Either>`
    });
});
```

Now let's see how we can check what `initialize` did. Let's write some assertions:

```ts
import { isRight } from "fp-ts/lib/Either";

it("When initialize is called Then it runs successfully", async () => {
    const result = await loader.initialize({
        client: clientStub.client,
        jobScheduler: jobSchedulerStub,
    })();

    // Either is either left (an error) or right (a result)
    // we check if the result is a right 👇
    expect(isRight(result)).toBeTruthy();
});
```

You can run the tests in `content-gateway-loader` by executing this command:

```bash
nx test content-gateway-loader
```

If you want your tests to be re-run automatically on every change use `--watch`:

```bash
nx test content-gateway-loader --watch
```

Now let's see how we can check whether `initialize` did anything at all...let's look at the stubs! 👀

```ts
it("When initialize is called Then it schedules a job", async () => {
    await loader.initialize({
        client: clientStub.client,
        jobScheduler: jobSchedulerStub,
    })();

    expect(jobSchedulerStub.scheduledJobs[0].name).toEqual(loader.name);
});
```

Well done! You've successfully unit tested `initialize`! 🎉

### Some Notes on Testing

Writing unit tests is useful if you want to make sure that your `Loader` works properly. This won't check your `Loader` end-to-end. The advantage of unit tests is that they are blazingly fast and if you keep the `--watch` on while you're working on them then you'll always know if something is broken.

Writing integration tests (to see how this works end-to-end) is currently out of the scope of this guide. Check back later! 😎
