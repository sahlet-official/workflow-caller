import * as core from '@actions/core';

async function genOidcToken(address: string, oidc_audience: string): Promise<string> {
  if (oidc_audience.trim() === '') {
    oidc_audience = address;
  }

  const token = await core.getIDToken(oidc_audience);

  return token;
}

async function makeCall(
  oidc_token: string,
  address: string,
  owner: string,
  repo: string,
  workflow: string,
  ref: string,
  input: string,
  call_type: string,
  max_wait_time: string
): Promise<string> {
  const url = `https://${address}/github-workflow-call`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: oidc_token,
      callInput: {
        input: JSON.parse(input),
        callType: call_type,
        callAddress: {
          owner: owner,
          repo: repo,
          workflowFile: workflow,
          ref: ref,
        },
        maxWaitingTimeInSeconds: max_wait_time
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`
      Error:
      HTTP status: ${response.status},
      details ${response.json()}
    `);
  }

  return await response.json();
}

async function run() {
  const address = core.getInput('address', { required: true });
  const owner = core.getInput('owner', { required: true });
  const repo = core.getInput('repo', { required: true });
  const workflow = core.getInput('workflow', { required: true });
  const ref = core.getInput('repo', { required: true });
  let oidc_token = core.getInput('oidc_token');
  const oidc_audience = core.getInput('oidc_audience');
  const input = core.getInput('input');
  const call_type = core.getInput('call_type');
  const max_wait_time = core.getInput('max_wait_time');
  const fail_on_error = core.getInput('fail_on_error') === 'true' ? true :
    (core.getInput('fail_on_error') === 'false' ? false : 'unknown');

  if (fail_on_error === 'unknown') {
    throw new Error("unknown value of fail_on_error parameter");
  }

  try {
    if (oidc_token.trim() === '') {
        oidc_token = await genOidcToken(address, oidc_audience);
    }

    const result = await makeCall(
        oidc_token,
        address,
        owner,
        repo,
        workflow,
        ref,
        input,
        call_type,
        max_wait_time
    );

    if (call_type === 'TriggerAndWaitResult') {
        core.setOutput('result', result);
    }

    if (call_type === 'Trigger') {
        core.info('Workflow triggered successfully');
    }

    if (call_type === 'TriggerAndWait' || call_type === 'TriggerAndWaitResult') {
        core.info('Workflow finished successfully');
    }
  } catch (error) {
    if (fail_on_error) {
        throw error;
    } else {
        core.error(`Error: ${(error as Error).message}`);
    }
  }
}

run().catch((err) => core.setFailed(err.stack ? `${err.message}\n${err.stack}` : err.message));