import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import {
  checkIdentityResponse,
  runIdentityResponseSmoke,
  validateIdentityResponse,
} from './check-response-delivery.mjs';

const completeHtml = `<!doctype html><html><body>${'content'.repeat(20)}</body></html>`;

function htmlResponse(body, headers = {}) {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    status: 200,
  });
}

test('accepts a complete uncompressed HTML response', () => {
  const response = htmlResponse(completeHtml);
  const result = validateIdentityResponse({
    body: completeHtml,
    minBytes: 100,
    response,
    url: 'https://example.test/',
  });

  assert.equal(result.bytes, Buffer.byteLength(completeHtml));
});

test('rejects a partial HTML response even when it returns 200', () => {
  const body = completeHtml.replace('</html>', '');

  assert.throws(
    () =>
      validateIdentityResponse({
        body,
        minBytes: 100,
        response: htmlResponse(body),
        url: 'https://example.test/',
      }),
    /did not deliver the closing <\/html> tag/,
  );
});

test('rejects compressed content returned to an identity request', () => {
  assert.throws(
    () =>
      validateIdentityResponse({
        body: completeHtml,
        minBytes: 100,
        response: htmlResponse(completeHtml, { 'content-encoding': 'gzip' }),
        url: 'https://example.test/',
      }),
    /unexpectedly returned content-encoding gzip/,
  );
});

test('sends Accept-Encoding identity and retries a transient failure', async () => {
  const encodings = [];
  let calls = 0;
  const fetchImpl = async (_url, init) => {
    calls += 1;
    encodings.push(init.headers['accept-encoding']);
    if (calls === 1) throw new Error('temporary deploy propagation failure');
    return htmlResponse(completeHtml);
  };

  const results = await runIdentityResponseSmoke(['https://example.test/'], {
    attempts: 2,
    fetchImpl,
    minBytes: 100,
    retryDelayMs: 0,
    sleep: async () => {},
    timeoutMs: 100,
  });

  assert.deepEqual(encodings, ['identity', 'identity']);
  assert.equal(results[0].attempt, 2);
});

test('rejects a redirect even when its destination is complete HTML', async (t) => {
  let requests = 0;
  const server = http.createServer((request, response) => {
    requests += 1;

    if (request.url === '/redirect') {
      response.writeHead(302, { location: '/complete' });
      response.end();
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(completeHtml);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const address = server.address();
  assert(address && typeof address === 'object');

  await assert.rejects(
    checkIdentityResponse(`http://127.0.0.1:${address.port}/redirect`, {
      minBytes: 100,
      timeoutMs: 100,
    }),
    /expected HTTP 200, got 302/,
  );
  assert.equal(requests, 1);
});

test('times out when a response starts but never finishes', async (t) => {
  const server = http.createServer((request, response) => {
    assert.equal(request.headers['accept-encoding'], 'identity');
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.write('<!doctype html><html><body>partial');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const address = server.address();
  assert(address && typeof address === 'object');

  await assert.rejects(
    checkIdentityResponse(`http://127.0.0.1:${address.port}/`, {
      minBytes: 1,
      timeoutMs: 50,
    }),
    /identity response timed out after 50 ms/,
  );
});
