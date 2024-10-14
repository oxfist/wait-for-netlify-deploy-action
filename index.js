const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');

const API_URL = 'https://api.netlify.com/api/v1/';
const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;

const apiGet = async ({ path }) => {
  try {
    console.log(`GET: `, path);
    const config = {
      method: 'get',
      url: new URL(path, API_URL).toString(),
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
      },
    };
    const response = await axios(config);
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
    const deploys = await apiGet({ path: `sites/${siteId}/deploys` });
    return deploys.find(
      (deploy) =>
        deploy.commit_ref === sha &&
        deploy.context === (isPreview ? 'deploy-preview' : 'production')
    );
  } catch (err) {
    core.setFailed(err.message);
  }
};

const waitForDeploy = async ({ siteId, isPreview, sha, attemptsRemaining }) => {
  const currentDeploy = await getCurrentDeploy({ siteId, isPreview, sha });

  console.log(`Attempts remaining: ${attemptsRemaining}`);

  if (currentDeploy && attemptsRemaining > 0) {
    if (currentDeploy.state === 'ready') {
      console.log('deploy is ready');
      return currentDeploy;
    } else if (currentDeploy.state === 'error') {
      console.log('deploy failed');
      return null;
    } else {
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

const waitForLiveDeploy = async ({ siteId, isPreview, sha, MAX_TIMEOUT }) => {
  const iterations = MAX_TIMEOUT / 10;
  let attemptsRemaining = iterations;
  let currentDeploy = null;

  for (let i = 0; i < iterations; i++) {
    try {
      currentDeploy = await getCurrentDeploy({ siteId, isPreview, sha });
      if (currentDeploy) {
        break;
      } else {
        attemptsRemaining--;
        await new Promise((r) => setTimeout(r, 10000));
      }
    } catch (e) {
      console.log(e);
      core.setFailed('Wait for Netlify failed');
      return;
    }
  }

  if (!currentDeploy) {
    core.setFailed(`Can't find Netlify related to commit: ${sha}`);
  }

  currentDeploy = await waitForDeploy({
    siteId,
    isPreview,
    sha,
    attemptsRemaining,
  });
  if (currentDeploy) {
    let url = currentDeploy.deploy_ssl_url;

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
    const isPreview = core.getInput('is_preview', { required: true });
    const SHA = github.context.payload.pull_request
      ? github.context.payload.pull_request.head.sha
      : github.context.payload.head_commit.id;
    const MAX_TIMEOUT = Number(core.getInput('max_timeout')) || 120;
    console.log(`Max timeout: ${MAX_TIMEOUT}s`);

    if (!siteId || isPreview === undefined) {
      core.setFailed(
        `Required field ${
          !siteId ? '`site_id`' : '`isPreview`'
        } was not provided`
      );
    }

    console.log(
      `Waiting for a ${isPreview ? 'PREVIEW' : 'NON-PREVIEW'} deploy`
    );
    const deployUrl = await waitForLiveDeploy({
      siteId,
      isPreview,
      sha: SHA,
      MAX_TIMEOUT,
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
