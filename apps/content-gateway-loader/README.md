# Content Gateway Loader

This application implements the *pull* loading model for the [Content Gateway](../../README.md).

If you want to implement a custom loader read on. If you're not sure what you're looking for go to the [root directory](../../README.md) of this project.

## Loading Data

This project is all about getting data from an external data source into the *Content Gateway*.

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

The cursor is an arbitrary number (usually a timestamp) that represents the point where we "left off" since the last batch was loaded. You can use this construct to continue loading data if for example the data set is too big and it would be unfeasible to load it in one go. Another use case is when the data source is updated periodically and you want to remember when was the last update on your pat. More info about cursors [here](http://mysql.rjweb.org/doc.php/pagination).

### Writing a Loader

Now let's take a look at how a `Loader` can be implemented.

You can put your loader anywhere but we'd recommend the `app/loaders` folder.

Since we're going to send data to the *Content Gateway* we need to declare the structure of the data that we're sending:

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
                logger.info(`Scheduled job ${JSON.stringify(result)}`);
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