# Content Gateway

This is the monorepo for **Content Gateway**. You can follow the links below to learn more.

-   [Content Gateway API][cg-api-project]: central storage module for both *schema*s and _data_.
-   [Content Gateway Loader][cg-loader-project]: module responsible for implementing the _pull_ ingeration mechanism (eg: when we load data from external systems)
-   [Content Gateway SDK][cg-sdk-project]: library package responsible for implementing the _push_ integration mechanism (eg: when you send the data to the CG API).

If you want to write custom _pull_ integration logic, head over to the [Content Gateway Loader][cg-loader-project] `README` and read the guide.

If you want to consume content from the Content Gateway API, take a look at our [GraphQL API][graphql-api].

If you want to start working on the Content Gateway read on.

## Development

> 📙 A note about operating systems: this guide will work with Linux, macOS and WSL environments. Other environments are not supported. This means that you can still work on the codebase, but you'll have to figure out how to do all the stuff that's outlined below. 👇

Before you can start working on the codebase you'll need to install:

-   Git
-   Node.js (and preferably nvm)
-   Docker (Docker Desktop on Windows) _(Optional)_
-   VS Code _(Optional)_
-   Heroku CLI _(Optional)_

### Environmental Variables

In order to be able to start working on the code you'll need to set the following environmental variables.

```bash
# Content Gateway API

export CGA_PORT="3333"                    # Will be used locally. On Heroku the PORT variable is used.
export MONGO_CGA_URL=<your_mongodb_url>   # The URL that points to your MongoDB instance
export MONGO_CGA_USER=<your_mongodb_user> # The MongoDB user name (will be used as a database name)


# Content Gateway Loader

export CGL_PORT=3334                        # Will be used locally. On Heroku the PORT variable is used
export CGA_URL=http://localhost:${CGA_PORT} # This is necessary for the Loader even on Heroku.
export GHOST_API_KEY="<ghost_api_key>"      # For the Bankless website.
export YOUTUBE_API_KEY="<youtube_api_key>"  # For the Bankless podcast.
export PG_CGL_URL="<your_postgres_url>"       # The URL that points to your Postgres instance.


# Optional variables

export NODE_ENV="development" # or production
export RESET_DB="true"        # If you want to reset the database when the application starts up
```

### Heroku Setup

If you want to deploy an instance to _Heroku_, these are the necessary steps:

> 📙 Make sure that you call `heroku login` before trying to do this. You'll also need the Heroku CLI installed

First, we create the apps on Heroku:

```bash
heroku create content-gateway-api --remote cga # --team if you use teams
heroku create content-gateway-loader --remote cgl # --team if you use teams
```

Now you need to add the [multi-procfile buildpack](https://elements.heroku.com/buildpacks/heroku/heroku-buildpack-multi-procfile) to them.
This is because Heroku assumes that you have one app per repo by default, and this enables to have multiple `Procfile`s (deployments) in a repo

```bash
heroku buildpacks:add --app content-gateway-api heroku-community/multi-procfile
heroku buildpacks:add --app content-gateway-loader heroku-community/multi-procfile
```

Of course this won't work because Heroku doesn't know about node, so we need to add the node buildpack too:

```bash
heroku buildpacks:add --app content-gateway-api heroku/nodejs
heroku buildpacks:add --app content-gateway-loader heroku/nodejs
```

Then we'll have to tell Heroku where these `Procfile`s are:

```bash
heroku config:set --app content-gateway-api PROCFILE=apps/content-gateway-api/Procfile
heroku config:set --app content-gateway-loader PROCFILE=apps/content-gateway-loader/Procfile
```

Then we'll need to add a `heroku-postbuild` script to override the default build behavior of Heroku and let it build the project we need. This goes into the `package.json` in the root folder:

```json
scripts: {
  "heroku-postbuild": "heroku-postbuild": "script/heroku-build $PROJECT_NAME"
}
```

> 📗 A note on the `script` folder: this project follows the [Scripts to Rule them All](https://github.com/github/scripts-to-rule-them-all) guidelines.
> You'll find scripts for most tasks that you might want to execute there. If you call a script you'll see some documentation too.

Heroku needs to know the value of `$PROJECT_NAME` for each deployment so let's set them:

```bash
heroku config:set --app content-gateway-api PROJECT_NAME=content-gateway-api
heroku config:set --app content-gateway-loader PROJECT_NAME=content-gateway-loader
```

One last thing before we can push this: the `CGA_URL` needs to be set for the Heroku deployment too, so let's add it:

```bash
# at the time of writing this was the URL, it might change later 👇
heroku config:set CGA_URL=https://content-gateway-api.herokuapp.com/ --remote cgl
```

Finally, we push it to _Heroku_

> 📙 Don't forget to commit your changes before pushing 😅

```bash
git push cga master
git push cgl master
```

With this you'll be able to **start** the apps, but they won't work still 😅, because we haven't configured the databases yet!

Let's take a look at how to do this.

### Database Setup

The _Content Gateway Loader_ uses Postgresql. Adding Postgres to Heroku is [relatively simple](https://devcenter.heroku.com/articles/heroku-postgresql).

Fist you'll need to create a Heroku Postgres database for the loader.

> 📗 Note that this is already created for the production deployment, you'll only need this if you
> want to create your own Content Gateway instances.

```bash
heroku addons:create heroku-postgresql:standard-0 --remote cgl --name=pg-cgl --as=pg_cgl
```

The `--as` parameter will make sure that Heroku creates the proper environemntal variables (by default it will create `DATABASE_URL` which is not very nice).

> 📙 If you have different environments keep the `--as` parameter as-is, as it will affect the name of the environmental variable.
> So if you have a prod and a staging environment you'll call this command like this:
> `heroku addons:create heroku-postgresql:standard-0 --remote prod_cgl --name=prod-pg-cgl --as=pg_cgl`

As for the API we're going to need MongoDB. _Heroku_ doesn't come with a MongoDB addon, so we'll need to use somethign else. What I'd suggest trying out is [Atlas](https://www.mongodb.com/atlas/database).

Once you set up the Atlas instance you can just set the `MONGO_CGA_URL` environment variable for the API instance and it'll work.

### Local Development

If you don't want to deploy your own _Content Gateway_ instances to _Heroku_, it is enough to set it up locally. We _recommend_ using [VS Code](https://code.visualstudio.com/).

#### Extensions

There are a list of extensions that you will probably need:

-   npm
-   npm Intellisense
-   Path Intellisense
-   ESLint: Linting tool for JS/TS
-   Node.js Extension Pack (This is for Node.js)
-   Prettier: Code formatter
-   GitHub Copilot: You want to try this out if you still haven't done it
-   Jest Runner: Runs Jest tests from the editor
-   Nx Console: This is for running Nx commands
-   Prisma: We use Prisma in the Loader
-   SonarLint: Another linting tool that's very useful
-   Terminals Manager: helps with managing multiple terminals

Other not so important extensions:

-   _Better Comments_: this will give better highlights for some comments in the code
-   _Emoji_: Just for fun, this will allow you to use emojis in your code
-   _Day Night Theme Switcher_: This is very useful as it will allow switching between dark and light themes

If you choose to use _Terminals Manager_ this is a good configuration for this project (belongs in `.vscode/terminals.json`):

```json
{
    "autorun": true,
    "autokill": true,
    "terminals": [
        {
            "name": "api",
            "description": "Content Gateway API",
            "open": true,
            "focus": false,
            "recycle": false
        },
        {
            "name": "loader",
            "description": "Content Gateway Loader",
            "open": true,
            "focus": false,
            "recycle": false,
            "commands": ["script/prisma-generate cgl"]
        }
    ]
}
```

Once you've set your development environment up you can start working on the codebase. Make sure that you prepare the workspace with the `script/setup` script.

> 📗 A note on Nx: this project uses [Nx](https://nx.dev/) which helps with handling the _monorepo_. Explaining how it works is out of the scope of this guide, and
> you probably won't need it anyway as most commands have a `script`. It is recommended however to learn how it works.

#### Docker

You _don't need_ to use _Docker_ for local development, but we have created a setup using _Docker_ that's easy to use and takes care of all the infrastructure needs of the project.

> 📗 If you're not familiar with _Docker_ you can read more about it [here](https://www.docker.com/).

If you want to take advantage of this setup we have a script for creating and stopping a _Docker_ enviroment.

Use this script to start it:

```
script/docker-up
```

This will start a _MongoDB_ and a _Postgre SQL_ instance in Docker that's ready to be used from _Content Gateway_.

You can stop it with:

```
script/docker-down
```

> 📙 If you get permission errors make sure that these scripts have executable permissions. You can grant them by using `chmod +x <file_path>` in the terminal.

If you want to start the applications you can use the `script/serve` script with the appropriate parameters:

```
script/serve cga
script/serve cgl
```

> 📗 `cga` stands for _Content Gateway API_ and `cgl` stands for for _Content Gateway Loader_.

If you thing you've messed something up you can also reset the databases by providing the `RESET_DB="true"` environmental variable.

For ease of use we recommend creating some aliases (you can put these in `.bashrc` or `.zshrc`):

```
alias nsa="script/serve cga"
alias nsl="script/serve cgl"
alias nsar="RESET_DB=true script/serve cga"
alias nslr="RESET_DB=true script/serve cgl"
```

`script/serve` will start a development environment that also supports _hot code replace_. If you need a production environment you can use the following commands to build the application and run it:

> 📗 For all scripts that accept a `<project>` parameter you can pass either `cga` or `cgl`.

```
script/build <project>
script/run <project>
```

_Congratulations!_ You've completed the project setup and now you're ready to start working!

### A Note on fp-ts

We're using fp-ts and io-ts in this project. These libraries implement strictly typed _Functional Programming_ in _TypeScript_. If you're not familiar with the topic you can learn it quickly by following through these guides:

-   [Practical Guide to Fp-ts](https://rlee.dev/series/practical-guide-to-fp-ts)
-   [Domain modeling in TypeScript](https://dev.to/ruizb/introduction-961)
-   [Functional design](https://dev.to/gcanti/functional-design-combinators-14pn)
-   [fp-ts cheat sheet](https://github.com/inato/fp-ts-cheatsheet)
-   [Getting started with fp-ts](https://dev.to/gcanti/getting-started-with-fp-ts-setoid-39f3)
-   [Interoperability with non functional code using fp-ts](https://dev.to/gcanti/interoperability-with-non-functional-code-using-fp-ts-432e)
-   [Getting started with fp-ts: IO](https://dev.to/gcanti/getting-started-with-fp-ts-io-36p6)
-   [Getting started with fp-ts: Reader](https://dev.to/gcanti/getting-started-with-fp-ts-reader-1ie5)
-   [Approximating haskell's do syntax in Typescript](https://paulgray.net/do-syntax-in-typescript/)
-   [fp-ts and Beautiful API Calls](https://dev.to/gnomff_65/fp-ts-and-beautiful-api-calls-1f55)

You can also take a look around the author's [website](https://paulgray.net/)

### Directory Structure

We use the [Nx guidelines](https://nx.dev/l/r/structure/grouping-libraries) for the directory structure. This means that we have the following folders:

-   `apps`: This is where all the **deployable** code resides including the `content-gateway-api` and the `content-gateway-loader` projects.
-   `libs`: This is where all the **shared** code can be found. We take advantage of _Nx_'s code sharing feature. Within the `libs` folder we also have some subfolders:
    -   `banklessdao`: This is where we keep all the packages that we intend to deploy to `npm`
    -   `domain`: Contains all the **domain code** including the _gateway API_ implementation (`feature-gateway`) and the custom loaders (`feature-loaders`)
    -   `shaerd`: This is where we keep the library code that's shared between the other top level modules.

### Creating a Loader

If you've read all this you might want to get your toes wet by creating a loader! Fret not, we've got you covered. Take a look at the guide in the [Loader's README file][cg-loader-project].

[cg-sdk-project]: /libs/banklessdao/content-gateway-sdk
[cg-api-project]: /apps/content-gateway-api
[cg-loader-project]: /apps/content-gateway-loader
[graphql-api]: https://prod-content-gateway-api.herokuapp.com/api/v1/graphql
