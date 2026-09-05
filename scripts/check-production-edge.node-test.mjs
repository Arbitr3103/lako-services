import assert from 'node:assert/strict';
import test from 'node:test';

import { checkProductionEdge } from './check-production-edge.mjs';
import { EXPECTED_SECURITY_HEADERS } from './http-security-headers.mjs';

function securityHeaders(overrides = {}) {
  return Object.fromEntries([...EXPECTED_SECURITY_HEADERS, ...Object.entries(overrides)]);
}

test('verifies HTTPS enforcement and production security headers', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ init, url });
    if (url === 'http://lako.services/') {
      return new Response(null, { status: 301, headers: { location: 'https://lako.services/' } });
    }
    return new Response(null, { status: 200, headers: securityHeaders() });
  };

  const result = await checkProductionEdge({ fetchImpl, timeoutMs: 100 });

  assert.deepEqual(result, { httpsStatus: 200, redirectStatus: 301 });
  assert.equal(requests[0].init.redirect, 'manual');
  assert.equal(requests[0].init.headers, undefined);
  assert.equal(requests[1].init.method, 'GET');
});

test('checks the same GET representation as the full-body delivery smoke', async () => {
  const fetchImpl = async (url, init) => {
    if (url === 'http://lako.services/') {
      return new Response(null, { status: 301, headers: { location: 'https://lako.services/' } });
    }
    // The edge can classify a HEAD or a different request signature separately.
    if (init.method !== 'GET' || init.headers?.['user-agent'] !== 'lako-identity-response-smoke/1.0'
      || init.headers?.['accept-encoding'] !== 'identity' || init.headers?.accept !== 'text/html') {
      return new Response(null, { status: 403, headers: { 'cf-mitigated': 'challenge' } });
    }
    return new Response('html fixture', { status: 200, headers: securityHeaders() });
  };
  assert.deepEqual(await checkProductionEdge({ fetchImpl }), { httpsStatus: 200, redirectStatus: 301 });
});

test('releases redirect and HTTPS bodies on success and rejection', async () => {
  for (const status of [200, 403]) {
    const cancelled = [];
    const fetchImpl = async (url) => {
      const body = new ReadableStream({ cancel() { cancelled.push(url); } });
      if (url === 'http://lako.services/') {
        return new Response(body, { status: 301, headers: { location: 'https://lako.services/' } });
      }
      return new Response(body, { status, headers: securityHeaders() });
    };
    if (status === 200) await checkProductionEdge({ fetchImpl });
    else await assert.rejects(checkProductionEdge({ fetchImpl }), /expected direct 200, got 403/);
    assert.deepEqual(cancelled, ['http://lako.services/', 'https://lako.services/']);
  }
});

test('fails when HTTP is served without a permanent HTTPS redirect', async () => {
  await assert.rejects(
    checkProductionEdge({ fetchImpl: async () => new Response(null, { status: 200 }), timeoutMs: 100 }),
    /expected permanent HTTPS redirect, got 200/,
  );
});

test('fails when the HTTPS response omits a required security header', async () => {
  const fetchImpl = async (url) => {
    if (url === 'http://lako.services/') {
      return new Response(null, { status: 308, headers: { location: 'https://lako.services/' } });
    }
    const headers = securityHeaders();
    delete headers['x-frame-options'];
    return new Response(null, { status: 200, headers });
  };

  await assert.rejects(checkProductionEdge({ fetchImpl, timeoutMs: 100 }), /Unexpected x-frame-options/);
});

test('classifies an explicit Cloudflare challenge only when opted in', async () => {
  const fetchImpl = async (url) => {
    if (url === 'http://lako.services/') {
      return new Response(null, { status: 301, headers: { location: 'https://lako.services/' } });
    }
    return new Response(null, { status: 403, headers: { 'cf-mitigated': 'challenge' } });
  };

  const result = await checkProductionEdge({
    allowCloudflareChallenge: true,
    fetchImpl,
    timeoutMs: 100,
  });

  assert.deepEqual(result, { challenged: true, httpsStatus: 403, redirectStatus: 301 });
  await assert.rejects(
    checkProductionEdge({ fetchImpl, timeoutMs: 100, sleep: async () => {}, log: () => {} }),
    /expected direct 200, got 403/,
  );
});

test('does not hide an ordinary HTTPS 403 when challenge classification is enabled', async () => {
  const fetchImpl = async (url) => {
    if (url === 'http://lako.services/') {
      return new Response(null, { status: 301, headers: { location: 'https://lako.services/' } });
    }
    return new Response(null, { status: 403 });
  };

  await assert.rejects(
    checkProductionEdge({ allowCloudflareChallenge: true, fetchImpl, timeoutMs: 100 }),
    /expected direct 200, got 403/,
  );
});

function edgeSequence(responses) {
  const calls = [];
  const cancelled = [];
  let httpsCalls = 0;
  return {
    calls, cancelled,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url === 'http://lako.services/') {
        return new Response(null, { status: 301, headers: { location: 'https://lako.services/' } });
      }
      const index = httpsCalls++;
      const fixture = responses[index];
      assert.ok(fixture, 'unexpected extra HTTPS request');
      if (fixture instanceof Error) throw fixture;
      return new Response(new ReadableStream({ cancel() { cancelled.push(index); } }), fixture);
    },
  };
}

const challenged = (ray = 'a363b8283981254d-FRA') => ({
  status: 403, headers: { 'cf-mitigated': 'challenge', 'cf-ray': ray },
});

test('recovers only after a verified 200 on the second or third challenge attempt', async () => {
  for (const challengeCount of [1, 2]) {
    const sequence = edgeSequence([
      ...Array.from({ length: challengeCount }, () => challenged()),
      { status: 200, headers: securityHeaders() },
    ]);
    const waits = [];
    const logs = [];
    const result = await checkProductionEdge({
      fetchImpl: sequence.fetchImpl,
      sleep: async (ms) => {
        waits.push(ms);
        assert.equal(sequence.cancelled.length, waits.length, 'release body before waiting');
      },
      log: (line) => logs.push(line),
    });
    assert.deepEqual(result, { httpsStatus: 200, redirectStatus: 301 });
    assert.equal(sequence.calls.length, challengeCount + 2);
    assert.equal(new Set(sequence.calls.slice(1).map(({ init }) => init.signal)).size, challengeCount + 1);
    assert.deepEqual(waits, Array(challengeCount).fill(2000));
    assert.equal(sequence.cancelled.length, challengeCount + 1);
    assert.equal(logs.length, challengeCount);
    assert.ok(logs.every((line) => line.includes('a363b8283981254d-FRA')));
  }
});

test('fails after three confirmed challenges and records the final Ray ID', async () => {
  const sequence = edgeSequence([challenged(), challenged(), challenged('a363b8283981254e-FRA')]);
  const waits = [];
  const logs = [];
  await assert.rejects(checkProductionEdge({
    fetchImpl: sequence.fetchImpl,
    sleep: async (ms) => waits.push(ms),
    log: (line) => logs.push(line),
  }), /expected direct 200, got 403.*a363b8283981254e-FRA/);
  assert.equal(sequence.calls.length, 4);
  assert.deepEqual(waits, [2000, 2000]);
  assert.deepEqual(sequence.cancelled, [0, 1, 2]);
  assert.equal(logs.length, 3);
});

test('never retries ordinary failures, redirects, network errors or missing headers', async () => {
  for (const response of [
    { status: 403 },
    { status: 500, headers: { 'cf-mitigated': 'challenge' } },
    { status: 308, headers: { 'cf-mitigated': 'challenge', location: 'https://example.test/' } },
    { status: 200 },
    new Error('network failure'),
  ]) {
    const sequence = edgeSequence([response]);
    await assert.rejects(checkProductionEdge({
      fetchImpl: sequence.fetchImpl,
      sleep: async () => assert.fail('must not wait for a non-retryable failure'),
      log: () => {},
    }));
    assert.equal(sequence.calls.length, 2);
  }
});

test('a challenge does not make later ordinary errors or missing headers retryable', async () => {
  for (const response of [{ status: 403 }, { status: 200 }]) {
    const sequence = edgeSequence([challenged(), response]);
    const waits = [];
    await assert.rejects(checkProductionEdge({
      fetchImpl: sequence.fetchImpl, sleep: async (ms) => waits.push(ms), log: () => {},
    }));
    assert.equal(sequence.calls.length, 3);
    assert.deepEqual(waits, [2000]);
  }
});

test('pre-deploy classification remains one attempt and releases the challenge body', async () => {
  const sequence = edgeSequence([challenged()]);
  const result = await checkProductionEdge({
    allowCloudflareChallenge: true, fetchImpl: sequence.fetchImpl,
    sleep: async () => assert.fail('classification must not retry'), log: () => {},
  });
  assert.equal(result.challenged, true);
  assert.equal(sequence.calls.length, 2);
  assert.deepEqual(sequence.cancelled, [0]);
});

test('does not echo malformed Ray ID headers into workflow logs', async () => {
  const sequence = edgeSequence([challenged('::warning title=untrusted::payload'), { status: 200, headers: securityHeaders() }]);
  const logs = [];
  await checkProductionEdge({ fetchImpl: sequence.fetchImpl, sleep: async () => {}, log: (line) => logs.push(line) });
  assert.equal(logs.length, 1);
  assert.ok(logs[0].includes('unavailable'));
  assert.ok(!logs[0].includes('::warning'));
});
