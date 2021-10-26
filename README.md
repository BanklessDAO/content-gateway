

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

Then we'll have to tell Heroku where these `Procfile`s are:

```bash
heroku config:set --app content-gateway-api PROCFILE=apps/content-gateway-api/Procfile
heroku config:set --app content-gateway-ingester PROCFILE=apps/content-gateway-ingester/Procfile
```

Finally, we push it to heroku

```bash
git push cga master
git push cgi master
```

In