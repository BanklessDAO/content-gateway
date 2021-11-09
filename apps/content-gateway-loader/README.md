# Content Gateway Loader

This application implements the _pull_ loading model for the [Content Gateway](../../README.md).

If you want to implement a custom loader read on. If you're not sure what you're looking for go to the [root directory](../../README.md) of this project.

## Loading Data

This project is all about getting data from an external data source into the _Content Gateway_.

In order to do this we're going to write `Loader`s. Let's take a look at how a `Loader` works:

```ts
export type InitContext = {
    client: ContentGatewayClient;
    jobScheduler: JobScheduler;
};

export type LoadContext = {
    client: ContentGatewayClient;
    currentJob: Job;
    jobScheduler: JobScheduler;
};

type Loader = {
    name: string;
    initialize: (deps: InitContext) => TE.TaskEither<Error, void>;
    load: (
        deps: LoadContext
    ) => TE.TaskEither<Error, JobDescriptor | undefined>;
};
```

Each `Loader` has a `name`. This is what uniquely identifies it. The `initialize` function will be called when the `Loader` is created (each time the application starts).

In this function you'll have access to the `ContentGatewayClient` (to register your data structures) and the `JobScheduler` (to schedule jobs).

Whenever a scheduled job runs `load` will be called. You'll also have access to the current job here. Note that you don't have to schedule the next run of this job yourself, you just have to return a new `JobDescriptor` if you want to run the same loader again (which you probably want).

This construct is useful for throttling: you can decide after each run when to run the next one. The `JobDescriptor` is very simple:

```ts
export type JobDescriptor = {
    name: string;
    scheduledAt: DateTime;
    cursor?: bigint;
};
```

Here the `name` corresponds with the `Loader`'s name. We're using [luxon](https://moment.github.io/luxon/#/tour) to represent dates. `scheduledAt` is the next time when the loader should run.

The cursor is an arbitrary number (usually a timestamp) that represents the point where we "left off" since the last batch was loaded. You can use this construct to continue loading data if for example the data set is too big and it would be unfeasible to load it in one go. Another use case is when the data source is updated periodically and you want to remember when was the last update on your part. More info about cursors [here](http://mysql.rjweb.org/doc.php/pagination).

### Writing a Loader

Now let's take a look at how a `Loader` can be implemented.

You can put your loader anywhere but we'd recommend the `app/loaders` folder.

Since we're going to send data to the _Content Gateway_ we need to declare the structure of the data that we're sending:

```ts
import { Required } from "@tsed/schema";

const info = {
    namespace: "test",
    name: "CurrentTimestamp",
    version: "V1",
};

class CurrentTimestamp {
    @Required(true)
    value: number;
}
```

> Note that we're using decorators from [tsed](https://tsed.io/docs/converters.html) for this.

If you want to log stuff you can use `tslog`:

```ts
import { Logger } from "tslog";

const logger = new Logger({ name: "ExampleLoader" });
```

Now, that we have the metadata in place let's give our loader a `name`:

```ts
const name = "example-loader";
```

We'll refer to this in the implementation.

> Note that we're using fp-ts extensively. This is a library that implements functional programming constructs for Typescript. Take a look at the list of introductory material [here](../../README.md#a-note-on-fp-ts) if you're not familiar with it.

To create a loader we can call `createSimpleLoader`:

```ts
import { createSimpleLoader } from "..";

export const exampleLoader = createSimpleLoader({
    name: name,
    // ...
});
```

The first thing we're going to implement is `initialize`. This will return a `TaskEither<Error, void>`. `TaskEither` represents an asynchronous operation that can fail. (more info [here](https://rlee.dev/practical-guide-to-fp-ts-part-3)). In our case it either succeeds without returning a value (`void`) or fails with an `Error`.

Let's implement it now:

```ts
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { DateTime } from "luxon";

export const exampleLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        // 1. Create a pipeline
        return pipe(
            // 2. tryCatch wraps an async function and adds error handling
            TE.tryCatch(
                () => {
                    logger.info("Initializing example loader...");
                    // 3. we register our data structure with the Content Gateway
                    // 📗 note that this operation is safe to call multiple times
                    client.register(info, CurrentTimestamp);
                    // 4. we schedule a job to run now
                    return jobScheduler.schedule({
                        name: name,
                        scheduledAt: DateTime.now(),
                    });
                },
                // 5. instead of throwing an error we stuff it into the TaskEither
                (error: Error) => new Error(error.message)
            ),
            // 6. This only runs if the tryCatch succeeds
            // in that case we log the result
            TE.map((result) => {
                logger.info(`Scheduled job`, result);
                // 7. and return nothing (void)
                return undefined;
            })
        );
    },
    // ...
});
```

Next up is `load`:

```ts
export const exampleLoader = createSimpleLoader({
    // ...
    load: ({ client, currentJob }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing example loader.");
                    logger.info(`current job: ${currentJob}`);
                    // 1. we use the client to save the data
                    // this is where you'll implement the loading logic
                    // for your use case.
                    // Here we just send random dates.
                    await client.save(info, {
                        value: DateTime.local().toMillis(),
                    });
                },
                (error: Error) => error
            ),
            // 2. chain re-wraps the TaskEither. How this works:
            // - if the TaskEither was a success it gets the value out
            // - then we have to return a replacement TaskEither
            // in our case we don't care about the value, we just want
            // to schedule another job by returning a new JobDescriptor
            // If you don't want another job, you can return TE.right(undefined).
            TE.chain(() =>
                TE.right({
                    name: name,
                    scheduledAt: DateTime.now().plus({ minutes: 15 }),
                })
            )
        );
    },
});
```

Congratulations! You've created a loader! 🎉

> The source of this example is in the `ExampleLoader.ts` file.

### Registering the Loader

Now, that we have a loader we just have to register it with the `JobScheduler`. There is a function in `main.ts` that we can use for this purpose:

```ts
const registerLoaders = (scheduler: JobScheduler) => {
    // ...
};
```

All you need to do is to add a `register` call and then you're done:

```ts
import { exampleLoader } from "./app/loaders/ExampleLoader";

const registerLoaders = (scheduler: JobScheduler) => {
    scheduler.register(exampleLoader);
};
```

Good job! 🎈

### Testing

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

In order to write this test we're going to need an actual loader:

```ts
import { exampleLoader } from "./ExampleLoader";

describe("Given an example loader", () => {
    const loader = exampleLoader;

    it("When initialize is called Then it runs successfully", () => {});
});
```

Now we can start testing. The good thing is that this loader has no internal state, so we don't have to re-instantiate it for every test.

Let's see how we can write the test for `initialize`. We're going to use the stub client and the stub scheduler that we provide. We're also going to add a function that
re-initializes the stub before each test:

```ts
import { exampleLoader } from "./ExampleLoader";
import {
    createStubClient,
    StubClientObjects,
} from "@banklessdao/content-gateway-client";
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


