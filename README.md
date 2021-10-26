

# Content Gateway

This is the monorepo for *Content Gateway*. You can follow the links below to learn more.

- [Content Gateway API](/apps/content-gateway-api): central storage module for both *schema*s and *data*.
- [Content Gateway Ingester](/apps/content-gateway-ingester): module responsible for implementing the *pull* ingeration mechanism (eg: when we load data from external systems)
- [Content Gateway Client](/libs/banklessdao/content-gateway-client): library package responsible  for implementing the *push* integration mechanism (eg: when you send the data to the CG API).

## Getting Started

> If you'd like to learn more on how to start working on the codebase skip to [Development](#development)

## Development

Before you can start working on the codebase you'll need to install:

- Docker (Docker Desktop on Windows)


### Environmental Variables

In order to be able to use the database(s) properly you'll need to set the following environmental variables.

```bash
export PG_CGI_PORT=8050
export PG_CGI_PASSWORD="<figure_out_a_good_password>"
export PG_CGI_USER="cgi_local"   
export PG_CGI_URL="postgresql://${PG_CGI_USER}:${PG_CGI_PASSWORD}@localhost:${PG_CGI_PORT}/${PG_CGI_USER}"

export PG_CGA_PORT=8051
export PG_CGA_PASSWORD="<figure_out_a_good_password>"
export PG_CGA_USER="cga_local"   
export PG_CGA_URL="postgresql://${PG_CGA_USER}:${PG_CGA_PASSWORD}@localhost:${PG_CGA_PORT}/${PG_CGA_USER}"
```

## Heroku Setup

In case this needs to be redeployed to Heroku, these are the necessary steps:

> Make sure that you call `heroku login` before trying to do this. You'll also need the Heroku CLI installed

First, we create the apps on Heroku:

```bash
heroku create content-gateway-api --remote cga
heroku create content-gateway-ingester --remote cgi
```

Now you need to add the [multi-procfile buildpack](https://elements.heroku.com/buildpacks/heroku/heroku-buildpack-multi-procfile) to them. This is because Heroku assumes that you have one app per repo by default, and this enables to have multiple `Procfile`s (deployments) in a repo


```bash
heroku buildpacks:add --app content-gateway-api heroku-community/multi-procfile
heroku buildpacks:add --app content-gateway-ingester heroku-community/multi-procfile
```

Of course this won't work because Heroku doesn't know about node, so we need to add the node buildpack too:

```bash
heroku buildpacks:add --app content-gateway-api heroku/nodejs
heroku buildpacks:add --app content-gateway-ingester heroku/nodejs
```

Then we'll have to tell Heroku where these `Procfile`s are:

```bash
heroku config:set --app content-gateway-api PROCFILE=apps/content-gateway-api/Procfile
heroku config:set --app content-gateway-ingester PROCFILE=apps/content-gateway-ingester/Procfile
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
heroku config:set --app content-gateway-ingester PROJECT_NAME=content-gateway-ingester
```

Finally, we push it to heroku

```bash
git push cga master
git push cgi master
```

With this you'll be able to **start** the apps, but they won't work still 😅, because we haven't configured the databases yet!

Let's take a look at how to do this.

### Database Setup

Adding Postgres to Heroku is [relatively simple](https://devcenter.heroku.com/articles/heroku-postgresql).

Fist you'll need to create a postgres for each app:

```bash
heroku addons:create heroku-postgresql:hobby-dev --remote cga --name=pg-cga --as=pg_cga
heroku addons:create heroku-postgresql:hobby-dev --remote cgi --name=pg-cgi --as=pg_cgi
```

The `--as` parameter will make sure that Heroku creates the proper environemntal variables (by default it will create `DATABASE_URL` which is not very nice).

Now we'll need to set the databases up locally. Please refer to the [development](#development) part of this readme for more details.


All is left to do now is to make sure that there is a release phase configured in all `Procfile`s:

```bash
release: npx prisma migrate deploy
```



