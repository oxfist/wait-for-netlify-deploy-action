# Wait for Netlify \[Preview\] Deploy — A GitHub Action ⏱

<!-- Action waiting for live site or preview branch to be deployed. Using pure -->
<!-- [Netlify API](https://docs.netlify.com/api/get-started/) and minimum config. -->

## Example usage

Basic Usage

```yaml
steps:
  - name: Waiting for a Netlify [Preview] Deploy to be live
    uses: oxfist/wait-for-netlify-deploy-action@2.0.0 # Latest release tag
    id: waitForLive
    with:
      site_id: 'curious-hummingbird-9f3bcd' # This is a fake example ID
      is_preview: true
      max_timeout: 60
```

## How it works

Using your site ID and site name, action will poll Netlify API to get proper
deploy status of the build related to the commit. It supports any flows, like
direct pushes to `main` branch or pull request flows.

You just have go to Netlify `Site Settings` menu, and find API ID:

<img alt="Screenshot of Netlify menu to find API ID" title="Screenshot of Netlify menu to find API ID" width="300" src="https://user-images.githubusercontent.com/6231516/145878940-5261aa63-181d-4459-9a5f-3ecd8cfdc3c9.png"/>

#### Live site

After pushing to master, action takes head commit, fetch Netlify deploy to
related commit and check the status. After deploy is `ready` - it output URL for
next action usage.

#### Preview site

Netlify has
[deploy previews](https://docs.netlify.com/site-deploys/deploy-previews/). On
created pull request, Netlify spins up separate deploy to allow user see their
changes. Action takes pull request commit, fetches Netlify deploy and checks the
status. After deploy is `ready` - it output URL (like -
`https://{deployId}--modest-murdock-6e792e.netlify.app`) for next action usage.

> Action uses permalink e.g.
> `https://61bf94e5e73b010007ea2a05--modest-murdock-6e792e.netlify.app` instead
> of deploy preview URL like
> `https://deploy-preview-1--modest-murdock-6e792e.netlify.app`. Permalink has
> pure site deploy without any additional scripts, while deploy preview enables
> more collaboration using
> [Netlify Drawer](https://docs.netlify.com/site-deploys/deploy-previews/#collaborative-deploy-previews).

Read Netlify [docs](https://docs.netlify.com/site-deploys/overview/#definitions)
about deploy deifnitions.

This action uses the Netlify API to always retrieve the correct deployment being
built. You will need to generate a
[Personal Access Token](https://app.netlify.com/user/applications/personal) to
use and pass it as the `NETLIFY_TOKEN` environment variable.

## Inputs

### `site_id: string`

**Required** The API ID of the Netlify site

### `is_preview: boolean`

**Required** Whether to wait for a preview deploy. URL generated will have
either of these formats:

- `https://deploy-preview-{pull_request_number}--{site_name}.netlify.app`
- `https://{site_name}.netlify.app`

### `max_timeout: number`

Optional — The amount of time to spend waiting on Netlify deploy to be created.

## Outputs

### `url: string`

The Netlify \[preview\] URL that was deployed.

<!-- ## How is it different from other Actions? -->
<!---->
<!-- I was inspired by <https://github.com/JakePartusch/wait-for-netlify-action>. -->
<!-- Hence this repo is a fork and keeps track of commits history for that action, -->
<!-- but bringing new API and workflow. -->

<!-- ## Recipes -->
<!---->
<!-- ### Recipe using with Lighthouse CI GitHub Action -->
<!---->
<!-- Netlify permalink deploy has disabled crawling option. Reponse header for the -->
<!-- site is set to `x-robots-tag: noindex` not to crawl other site deploy rather -->
<!-- than main site. You have to consider that while configuring action, otherwise -->
<!-- Lighthouse will low down score for SEO category. -->
<!---->
<!-- ```yml -->
<!-- steps: -->
<!--   - name: Wait Netlify Deployment with API Token -->
<!--     uses: jlevy-io/wait-for-netlify-deploy-with-headers@v1.0.0 -->
<!--     id: waitForNetlify -->
<!--     with: -->
<!--       site_id: 'c8e5be00-c431-44a5-bb0d-a179e1dd72f9' -->
<!--       max_timeout: 600 -->
<!--     env: -->
<!--       NETLIFY_TOKEN: ${{ secrets.NETLIFY_TOKEN }} -->
<!-- # Then use it in a later step like: -->
<!-- # ${{ steps.waitForNetlify.outputs.url }} -->
<!-- ``` -->
