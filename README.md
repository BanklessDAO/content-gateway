# Content Gateway

This is the monorepo for _Content Gateway_. You can follow the links below to learn more.

-   [Content Gateway API](/apps/content-gateway-api): central storage module for both *schema*s and _data_.
-   [Content Gateway Loader](/apps/content-gateway-loader): module responsible for implementing the _pull_ ingeration mechanism (eg: when we load data from external systems)
-   [Content Gateway Client](/libs/banklessdao/sdk): library package responsible for implementing the _push_ integration mechanism (eg: when you send the data to the CG API).

If you want to write custom _pull_ integration logic, head over to the [Content Gateway Loader](/apps/content-gateway-loader) README.

If you want to consume content from the Content Gateway API

If you want to start working on the Content Gateway read on.

## Getting Started

> If you'd like to learn more on how to start working on the codebase skip to [Development](#development)

## Development

Before you can start working on the codebase you'll need to install:

-   Docker (Docker Desktop on Windows)

### Environmental Variables

In order to be able to use the database(s) properly you'll need to set the following environmental variables.

```bash
# will be used locally. On Heroku the PORT variable is used
export CGL_PORT=3334
export CGA_PORT=3333

# this is necessary for the loader even on Heroku
export CGA_URL=http://localhost:${CGA_PORT}

# PostgreSQL variables
export PG_CGL_PORT=8050
export PG_CGL_PASSWORD="<figure_out_a_good_password>"
export PG_CGL_USER="cgl_local"
export PG_CGL_URL="postgresql://${PG_CGL_USER}:${PG_CGL_PASSWORD}@localhost:${PG_CGL_PORT}/${PG_CGL_USER}"

export PG_CGA_PORT=8051
export PG_CGA_PASSWORD="A3xB13DASwa2134hl"
export PG_CGA_USER="cga_local"
export PG_CGA_URL="postgresql://${PG_CGA_USER}:${PG_CGA_PASSWORD}@localhost:${PG_CGA_PORT}/${PG_CGA_USER}"
```

### Heroku Setup

In case this needs to be redeployed to Heroku, these are the necessary steps:

> Make sure that you call `heroku login` before trying to do this. You'll also need the Heroku CLI installed

First, we create the apps on Heroku:

```bash
heroku create content-gateway-api --remote cga
heroku create content-gateway-loader --remote cgl
```

Now you need to add the [multi-procfile buildpack](https://elements.heroku.com/buildpacks/heroku/heroku-buildpack-multi-procfile) to them. This is because Heroku assumes that you have one app per repo by default, and this enables to have multiple `Procfile`s (deployments) in a repo

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
  "heroku-postbuild": "nx build $PROJECT_NAME --prod"
}
```

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

Finally, we push it to heroku

```bash
git push cga master
git push cgl master
```

With this you'll be able to **start** the apps, but they won't work still 😅, because we haven't configured the databases yet!

Let's take a look at how to do this.

### Database Setup

Adding Postgres to Heroku is [relatively simple](https://devcenter.heroku.com/articles/heroku-postgresql).

Fist you'll need to create a postgres for each app:

> 📗 Note that this is already created for the production deployment, you'll only need this if you
> want to push it for yourself.

```bash
heroku addons:create heroku-postgresql:standard-0 --remote cga --name=pg-cga --as=pg_cga
heroku addons:create heroku-postgresql:standard-0 --remote cgl --name=pg-cgl --as=pg_cgl
```

The `--as` parameter will make sure that Heroku creates the proper environemntal variables (by default it will create `DATABASE_URL` which is not very nice).

Now we'll need to set the databases up locally. Please refer to the [development](#development) part of this readme for more details.

### A Note on fp-ts

We're using fp-ts, io-ts in this project. These libraries implement strictly typed Functional Programming in TypeScript. If you're not familiar with the topic you can learn it quickly by following through these guides:

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
