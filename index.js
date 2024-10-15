const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');

const DEFAULT_MAX_TIMEOUT = 120;
const API_URL = 'https://api.netlify.com/api/v1/';
const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;

const getDeploysFromAPI = async ({ path, log }) => {
  try {
    if (log) console.log('HTTP GET: ', path);
    const config = {
      method: 'get',
      url: new URL(path, API_URL).toString(),
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
      },
    };
    const response = await axios(config);

    if (response.status === 200) {
      if (log) console.log('HTTP GET 200 RESPONSE');
    } else {
      if (log) console.log('HTTP GET NOT SUCCESSFUL');
    }

    return response.data;
  } catch (err) {
    if (err && err.response && err.response.data && err.response.data.message) {
      core.setFailed(err.response.data.message);
    }
    core.setFailed(err.message);
  }
};

const getCurrentDeploy = async ({ siteId, isPreview, sha }) => {
  try {
    const deploys = await getDeploysFromAPI({
      path: `sites/${siteId}/deploys`,
      log: true,
    });
    console.log('Found deploys from Netlify API');

    if (isPreview) {
      const commitDeploys = deploys.filter((d) => d.commit_ref === sha);
      console.log('Found commit deploys');

      const latestPreviewDeploy = commitDeploys.find(
        (d) => d.context === 'deploy-preview'
      );
      if (latestPreviewDeploy) console.log('Found preview deploy');
      return latestPreviewDeploy;
    } else {
      const latestProductionDeploy = deploys.find(
        (d) => d.context === 'production'
      );
      if (latestProductionDeploy) console.log('Found production deploy');
      return latestProductionDeploy;
    }
  } catch (err) {
    core.setFailed(err.message);
  }
};

const waitForDeploy = async ({ siteId, isPreview, sha, attemptsRemaining }) => {
  const currentDeploy = await getCurrentDeploy({ siteId, isPreview, sha });

  console.log(`Attempts remaining: ${attemptsRemaining}`);
  if (currentDeploy && attemptsRemaining > 0) {
    if (currentDeploy.state === 'ready') {
      console.log('Deploy is ready');
      return currentDeploy;
    } else if (currentDeploy.state === 'error') {
      console.log('Deploy failed');
      return null;
    } else {
      console.log('Deploy not yet ready');
      await new Promise((r) => setTimeout(r, 10_000));

      return waitForDeploy({
        siteId,
        isPreview,
        sha,
        attemptsRemaining: attemptsRemaining - 1,
      });
    }
  } else {
    return null;
  }
};

const waitForLiveDeploy = async ({ siteId, isPreview, sha, maxTimeout }) => {
  const maxAttempts = maxTimeout / 10;
  let attemptsRemaining = maxAttempts;
  let currentDeploy = null;

  console.log(`Waiting for a ${isPreview ? 'PREVIEW' : 'NON-PREVIEW'} deploy`);
  console.log(`Initial attempts ${maxAttempts}`);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      currentDeploy = await getCurrentDeploy({ siteId, isPreview, sha });
      if (currentDeploy) {
        break;
      } else {
        attemptsRemaining--;
        console.log(`Attempts remaining: ${attemptsRemaining}`);
        await new Promise((r) => setTimeout(r, 10_000));
      }
    } catch (e) {
      console.log(e);
      core.setFailed('Wait for Netlify live deploy failed');
      return;
    }
  }

  if (!currentDeploy) {
    if (isPreview) {
      core.setFailed(
        `Couldn't find Netlify preview deploys related to commit: ${sha}`
      );
    } else {
      core.setFailed("Couldn't find production deploy");
    }
  }

  console.log(
    `Now waiting for ${
      isPreview ? 'PREVIEW' : 'NON-PREVIEW'
    } deployment to have status 'ready'`
  );
  currentDeploy = await waitForDeploy({
    siteId,
    isPreview,
    sha,
    attemptsRemaining,
  });

  if (currentDeploy) {
    let url = currentDeploy.deploy_ssl_url;

    // console.log(currentDeploy);
    // console.log(currentDeploy.id);
    // console.log(currentDeploy.name);
    // compose permalink URL without Netlify Preview drawer
    if (['deploy-preview', 'production'].includes(currentDeploy.context)) {
      url = `https://${currentDeploy.id}--${currentDeploy.name}.netlify.app`;
    }

    return url;
  } else {
    return null;
  }
};

const run = async () => {
  try {
    const PR_NUMBER = github.context.payload.number;

    if (!PR_NUMBER) {
      core.setFailed(
        'Action must be run in conjunction with the `pull_request` event'
      );
    }

    if (!NETLIFY_TOKEN) {
      core.setFailed('Required env `NETLIFY_TOKEN` was not provided');
    }

    const siteId = core.getInput('site_id', { required: true });
    const isPreview = core.getBooleanInput('is_preview', { required: true });

    const SHA = github.context.payload.pull_request
      ? github.context.payload.pull_request.head.sha
      : github.context.payload.head_commit.id;
    const MAX_TIMEOUT =
      Number(core.getInput('max_timeout')) || DEFAULT_MAX_TIMEOUT;
    console.log(`Max timeout: ${MAX_TIMEOUT}s`);

    if (!siteId || isPreview === undefined) {
      core.setFailed(
        `Required field ${
          !siteId ? '`site_id`' : '`isPreview`'
        } was not provided`
      );
    }

    console.log('Waiting for live deploy');
    const deployUrl = await waitForLiveDeploy({
      siteId,
      isPreview,
      sha: SHA,
      maxTimeout: MAX_TIMEOUT,
    });

    if (deployUrl) {
      core.setOutput('url', deployUrl);
    } else {
      core.setFailed('Netlify deploy error');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
};

run();
