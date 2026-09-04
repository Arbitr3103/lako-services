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
  assert.equal(requests[1].init.method, 'HEAD');
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
  await assert.rejects(checkProductionEdge({ fetchImpl, timeoutMs: 100 }), /expected direct 200, got 403/);
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
