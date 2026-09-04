import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../.github/workflows/deploy.yml', import.meta.url);
const challengeFlag = '--allow-cloudflare-challenge';

function parseRun(firstLine, body) {
  const lines = [firstLine, ...body.split('\n')];
  const runLineIndex = lines.findIndex((line) => line.startsWith('run: ') || line.startsWith('        run: '));

  if (runLineIndex === -1) return undefined;

  const runLine = lines[runLineIndex].trim();
  const value = runLine.slice('run: '.length);
  if (value !== '>-') return value;

  const foldedLines = [];
  for (const line of lines.slice(runLineIndex + 1)) {
    if (!line.startsWith('          ')) break;
    foldedLines.push(line.trim());
  }

  return foldedLines.join(' ');
}

function parseSteps(workflow) {
  const headers = [...workflow.matchAll(/^      - (?<firstLine>[^\n]+)$/gm)];

  return headers.map((header, index) => {
    const bodyStart = header.index + header[0].length + 1;
    const bodyEnd = headers[index + 1]?.index ?? workflow.length;
    const firstLine = header.groups.firstLine;
    const body = workflow.slice(bodyStart, bodyEnd);

    return {
      name: firstLine.startsWith('name: ') ? firstLine.slice('name: '.length) : undefined,
      run: parseRun(firstLine, body),
    };
  });
}

function findNamedStep(steps, name) {
  const step = steps.find((candidate) => candidate.name === name);
  assert.ok(step, `workflow must define the ${name} step`);
  assert.ok(step.run, `${name} must run a command`);
  return step;
}

function findStepIndex(steps, predicate, description) {
  const index = steps.findIndex(predicate);
  assert.notEqual(index, -1, `workflow must include ${description}`);
  return index;
}

test('keeps Cloudflare challenge classification only in the pre-deploy edge check', async () => {
  const steps = parseSteps(await readFile(workflowUrl, 'utf8'));
  const preDeploy = findNamedStep(steps, 'Verify production edge before deploy');
  const deployIndex = findStepIndex(
    steps,
    (step) => step.run === 'npm run deploy:worker',
    'the Worker deployment command',
  );
  const preDeployIndex = findStepIndex(
    steps,
    (step) => step.name === preDeploy.name,
    'the pre-deploy edge check',
  );

  assert.equal(preDeployIndex < deployIndex, true);
  assert.match(preDeploy.run, /npm run check:production-edge/);
  assert.match(preDeploy.run, /--allow-cloudflare-challenge/);
  assert.deepEqual(
    steps.filter((step) => step.run?.includes(challengeFlag)).map((step) => step.name),
    ['Verify production edge before deploy'],
  );
});

test('keeps every post-deploy delivery gate strict', async () => {
  const steps = parseSteps(await readFile(workflowUrl, 'utf8'));
  const deployIndex = findStepIndex(
    steps,
    (step) => step.run === 'npm run deploy:worker',
    'the Worker deployment command',
  );
  const workersDev = findNamedStep(steps, 'Verify complete identity responses on workers.dev');
  const customDomainIdentity = findNamedStep(
    steps,
    'Verify complete custom-domain identity responses',
  );
  const customDomainEdge = findNamedStep(steps, 'Verify production edge after deploy');

  for (const step of [workersDev, customDomainIdentity, customDomainEdge]) {
    const stepIndex = findStepIndex(steps, (candidate) => candidate.name === step.name, step.name);
    assert.equal(stepIndex > deployIndex, true, `${step.name} must run after deployment`);
    assert.doesNotMatch(step.run, /--allow-cloudflare-challenge/);
  }

  assert.match(workersDev.run, /https:\/\/lako-services\.bragin-arbitr\.workers\.dev\//);
  assert.match(customDomainIdentity.run, /https:\/\/lako\.services\//);
  assert.match(customDomainEdge.run, /npm run check:production-edge/);
});
