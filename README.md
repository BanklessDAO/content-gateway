

# Content Gateway

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
