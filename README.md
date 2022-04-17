# 🐢 Wait for Netlify Deploy — A GitHub Action

<img alt="Waiting for deploy logo" title="Waiting for deploy logo" width="300" src="https://user-images.githubusercontent.com/6231516/145876778-d6c79fff-4cb9-42f1-bb73-08ed33b06ba8.png"/>

Action waiting for live site or preview branch to be deployed.
Using pure [Netlify API](https://docs.netlify.com/api/get-started/) and minimum config.

## How it works

Using your site API Id, action will poll Netlify API to get proper deploy status of the build related to the commit.
It supports any flows, like direct pushes to `main` branch or pull request flows.

You just have go to Netlify `Site Settings` menu, and find API Id:

<img alt="Screenshot of Netlify menu to find API Id" title="Screenshot of Netlify menu to find API Id" width="300" src="https://user-images.githubusercontent.com/6231516/145878940-5261aa63-181d-4459-9a5f-3ecd8cfdc3c9.png"/>

#### Live site

After pushing to master, action takes head commit, fetch Netlify deploy to related commit and check the status. After deploy is `ready` - it output URL for next action usage.

#### Preview site

Netlify has [deploy previews](https://docs.netlify.com/site-deploys/deploy-previews/). On created pull request, Netlify spins up separate deploy to allow user see their changes. Action takes pull request commit, fetches Netlify deploy and checks the status. After deploy is `ready` - it output URL (like - `https://{deployId}--modest-murdock-6e792e.netlify.app`) for next action usage.

> Action uses permalink e.g. `https://61bf94e5e73b010007ea2a05--modest-murdock-6e792e.netlify.app` instead of deploy preview URL like `https://deploy-preview-1--modest-murdock-6e792e.netlify.app`.
> Permalink has pure site deploy without any additional scripts, while deploy preview enables more collaboration using [Netlify Drawer](https://docs.netlify.com/site-deploys/deploy-previews/#collaborative-deploy-previews).

Read Netlify [docs](https://docs.netlify.com/site-deploys/overview/#definitions) about deploy deifnitions.

This action uses the Netlify API to always retrieve the correct deployment being built. You will need to generate a [Personal Access Token](https://app.netlify.com/user/applications/personal) to use and pass it as the `NETLIFY_TOKEN` environment variable.

## Env

### `NETLIFY_TOKEN`

**Required.** Your Netlify [Personal Access Token](https://app.netlify.com/user/applications/personal) to use for API access. This should be set as a GitHub secret, see example.

## Inputs

### `site_id`

**Required** The API id of the Netlify site

### `max_timeout`

Optional — The amount of time to spend waiting on Netlify deploy to be created.

## Outputs

### `url`

Url of a site deploy related to the commit.

## How is it different from other Actions?

I was inspired by https://github.com/JakePartusch/wait-for-netlify-action.
Hence this repo is a fork and keeps track of commits history for that action, but bringing new API and workflow.

## Recipes

### Recipe using with Lighthouse CI GitHub Action

Netlify permalink deploy has disabled crawling option. Reponse header for the site is set to `x-robots-tag: noindex` not to crawl other site deploy rather than main site. You have to consider that while configuring action, otherwise Lighthouse will low down score for SEO category.

```yml
steps:
  - name: Wait for Netlify Deploy
    uses: jlevy-io/wait-for-netlify-deploy-with-headers@v1.0.0
    id: waitForNetlify
    with:
      site_id: 'c8e5be00-c431-44a5-bb0d-a179e1dd72f9'
      max_timeout: 600
    env:
      NETLIFY_TOKEN: ${{ secrets.NETLIFY_TOKEN }}
# Then use it in a later step like:
# ${{ steps.waitForNetlify.outputs.url }}
```
