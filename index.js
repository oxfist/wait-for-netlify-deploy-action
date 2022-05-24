const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');

const netlifyToken = process.env.NETLIFY_TOKEN;
const apiUrl = 'https://api.netlify.com/api/v1/';

const apiGet = async ({ path }) => {
  try {
    console.log(`GET: `, path);
    const config = {
      method: 'get',
      url: new URL(path, apiUrl).toString(),
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
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

const getCurrentDeploy = async ({ siteId, sha }) => {
  try {
    const deploys = await apiGet({ path: `sites/${siteId}/deploys` });
    return deploys.find(
      (deploy) =>
        deploy.commit_ref === sha && ['production', 'deploy-preview', 'branch-deploy'].includes(deploy.context)
    );
  } catch (err) {
    core.setFailed(err.message);
  }
};

const waitForDeploy = async ({ siteId, sha, attemptsRemaining }) => {
  const currentDeploy = await getCurrentDeploy({ siteId, sha });
  console.log(`Attempts remaining: ${attemptsRemaining}`);
  if (currentDeploy && attemptsRemaining > 0) {
    if (currentDeploy.state === 'ready') {
      console.log('deploy is ready');
      return currentDeploy;
    } else if (currentDeploy.state === 'error') {
      console.log('deploy failed');
      return null;
    } else {
      await new Promise((r) => setTimeout(r, 10000));
      return waitForDeploy({ siteId, sha, attemptsRemaining: attemptsRemaining - 1 });
    }
  } else {
    return null;
  }
};

const waitForLive = async ({ siteId, sha, MAX_TIMEOUT }) => {
  const iterations = MAX_TIMEOUT / 10;
  let attemptsRemaining = iterations;
  let currentDeploy = null;

  for (let i = 0; i < iterations; i++) {
    try {
      currentDeploy = await getCurrentDeploy({ siteId, sha });
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

  currentDeploy = await waitForDeploy({ siteId, sha, attemptsRemaining });
  if (currentDeploy) {
    let url = currentDeploy.deploy_ssl_url;
    // compose permalink URL without Netlify Preview drawer
    if (currentDeploy.context === 'deploy-preview') {
      url = `https://${currentDeploy.id}--${currentDeploy.name}.netlify.app`;
    }
    core.setOutput('url', url);
  } else {
    core.setFailed('Netlify deploy error');
  }
};

const run = async () => {
  try {
    const siteId = core.getInput('site_id');

    if (!siteId) {
      core.setFailed('Required field `siteId` was not provided');
    }

    if (!netlifyToken) {
      core.setFailed('Required env `NETLIFY_TOKEN` was not provided');
    }

    const MAX_TIMEOUT = Number(core.getInput('max_timeout')) || 120;
    console.log(`Max timeout: ${MAX_TIMEOUT}s`);
    const sha = github.context.payload.pull_request
      ? github.context.payload.pull_request.head.sha
      : github.context.payload.head_commit.id;

    await waitForLive({ MAX_TIMEOUT, siteId, sha });
  } catch (error) {
    core.setFailed(error.message);
  }
};

run();
