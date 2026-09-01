import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildReport } from './report.mjs';

const wrapperSource = fs.readFileSync(new URL('./daily-analytics.sh', import.meta.url), 'utf8');

function metricsRaw({ threats = 0, statuses = { 200: 10 }, requests = 10 } = {}) {
  return {
    data: {
      viewer: {
        zones: [
          {
            httpRequests1dGroups: [
              {
                sum: {
                  requests,
                  pageViews: 4,
                  threats,
                  bytes: 1024 * 1024,
                  browserMap: [],
                  responseStatusMap: Object.entries(statuses).map(([status, count]) => ({
                    edgeResponseStatus: Number(status),
                    requests: count,
                  })),
                  countryMap: [{ clientCountryName: 'RS', requests }],
                },
                uniq: { uniques: 3 },
              },
            ],
          },
        ],
      },
    },
  };
}

function firewallRaw(events = []) {
  return { data: { viewer: { zones: [{ firewallEventsAdaptive: events }] } } };
}

function postsRaw(groups = []) {
  return { data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: groups }] } } };
}

function workerRaw(errors = 0) {
  return {
    data: {
      viewer: {
        accounts: [{ workersInvocationsAdaptive: [{ sum: { errors } }] }],
      },
    },
  };
}

function makeInput(overrides = {}) {
  const monitored = {
    name: 'lako.services',
    securityMonitored: true,
    allowedPostPaths: ['/api/contact', '/api/register-business', '/cdn-cgi/'],
    metricsRaw: metricsRaw(),
    firewallRaw: firewallRaw(),
    postsRaw: postsRaw(),
    workerRaw: workerRaw(),
    ...overrides,
  };
  return {
    date: '2026-08-25',
    generatedAt: '2026-08-26T06:00:00.000Z',
    sites: [monitored],
    database: {},
  };
}

test('returns OK when all checks pass and no incident is present', () => {
  const report = buildReport(makeInput());

  assert.equal(report.summary.status, 'OK');
  assert.deepEqual(report.summary.criticalReasons, []);
  assert.match(report.message, /Security lako\.services: OK/);
});

test('limits the Cloudflare POST query to the monitored hostname', () => {
  assert.match(wrapperSource, /clientRequestHTTPHost: \$host/);
  assert.match(wrapperSource, /--arg host "\$LAKO_POST_HOST"/);
  assert.match(wrapperSource, /host:\$host/);
});

test('marks a new high-volume mitigated scanner fingerprint as ATTENTION', () => {
  const event = {
    action: 'block',
    clientIP: '203.0.113.10',
    clientRequestPath: '/wp-admin/install.php',
  };
  const report = buildReport(
    makeInput({ metricsRaw: metricsRaw({ threats: 3114 }), firewallRaw: firewallRaw([event]) }),
  );

  assert.equal(report.summary.status, 'ATTENTION');
  assert.equal(report.summary.newScannerFingerprints, 1);
  assert.equal(report.summary.repeatedScannerFingerprints, 0);
  assert.doesNotMatch(report.message, /⚠️3114 threats/);
  assert.match(report.message, /CF signals:3114/);
});

test('does not alert again for a scanner fingerprint already seen within seven days', () => {
  const event = {
    action: 'managed_challenge',
    clientIP: '203.0.113.10',
    clientRequestPath: '/wp-content/shell.php',
  };
  const first = buildReport(
    makeInput({ metricsRaw: metricsRaw({ threats: 3000 }), firewallRaw: firewallRaw([event]) }),
  );
  const secondInput = makeInput({
    metricsRaw: metricsRaw({ threats: 3500 }),
    firewallRaw: firewallRaw([event]),
  });
  secondInput.generatedAt = '2026-08-27T06:00:00.000Z';
  const second = buildReport(secondInput, first.nextState);

  assert.equal(second.summary.status, 'OK');
  assert.equal(second.summary.newScannerFingerprints, 0);
  assert.equal(second.summary.repeatedScannerFingerprints, 1);
});

test('marks any HTTP 5xx as CRITICAL', () => {
  const report = buildReport(
    makeInput({ metricsRaw: metricsRaw({ statuses: { 200: 9, 500: 1 } }) }),
  );

  assert.equal(report.summary.status, 'CRITICAL');
  assert.deepEqual(report.summary.criticalReasons, ['lako.services:5xx=1']);
});

test('marks Worker runtime errors as CRITICAL', () => {
  const report = buildReport(makeInput({ workerRaw: workerRaw(2) }));

  assert.equal(report.summary.status, 'CRITICAL');
  assert.deepEqual(report.summary.criticalReasons, ['worker-errors=2']);
});

test('marks a successful POST to an unknown route as CRITICAL', () => {
  const report = buildReport(
    makeInput({
      postsRaw: postsRaw([
        {
          count: 3,
          dimensions: {
            clientRequestHTTPMethodName: 'POST',
            clientRequestPath: '/graphql',
            edgeResponseStatus: 200,
          },
        },
      ]),
    }),
  );

  assert.equal(report.summary.status, 'CRITICAL');
  assert.deepEqual(report.summary.criticalReasons, ['unexpected-post-2xx=3']);
  assert.match(report.message, /unexpected POST 2xx details: \/graphql · 200 × 3/);
});

test('marks unknown POST redirects as ATTENTION and reports route details', () => {
  const report = buildReport(
    makeInput({
      postsRaw: postsRaw([
        {
          count: 12,
          dimensions: {
            clientRequestHTTPMethodName: 'POST',
            clientRequestPath: '/scanner-probe?attempt=1',
            edgeResponseStatus: 308,
          },
        },
      ]),
    }),
  );

  assert.equal(report.summary.status, 'ATTENTION');
  assert.deepEqual(report.summary.criticalReasons, []);
  assert.match(report.message, /unknown POST redirects: 12/);
  assert.match(report.message, /unknown POST redirect details: \/scanner-probe · 308 × 12/);
});

test('does not mark a rejected suspicious POST as critical', () => {
  const report = buildReport(
    makeInput({
      postsRaw: postsRaw([
        {
          count: 5,
          dimensions: {
            clientRequestHTTPMethodName: 'POST',
            clientRequestPath: '/graphql',
            edgeResponseStatus: 403,
          },
        },
      ]),
    }),
  );

  assert.equal(report.summary.status, 'OK');
  assert.match(report.message, /rejected suspicious POST: 5/);
});

test('allows successful POSTs on known application routes', () => {
  const report = buildReport(
    makeInput({
      postsRaw: postsRaw([
        {
          count: 2,
          dimensions: {
            clientRequestHTTPMethodName: 'POST',
            clientRequestPath: '/api/contact',
            edgeResponseStatus: 200,
          },
        },
        {
          count: 1,
          dimensions: {
            clientRequestHTTPMethodName: 'POST',
            clientRequestPath: '/api/contact',
            edgeResponseStatus: 308,
          },
        },
        {
          count: 4,
          dimensions: {
            clientRequestHTTPMethodName: 'POST',
            clientRequestPath: '/api/register-business',
            edgeResponseStatus: 201,
          },
        },
        {
          count: 11,
          dimensions: {
            clientRequestHTTPMethodName: 'POST',
            clientRequestPath: '/cdn-cgi/rum',
            edgeResponseStatus: 204,
          },
        },
      ]),
    }),
  );

  assert.equal(report.summary.status, 'OK');
});

test('marks e-Faktura POSTs on lako.services as CRITICAL', () => {
  const report = buildReport(
    makeInput({
      postsRaw: postsRaw([
        {
          count: 7,
          dimensions: {
            clientRequestHTTPHost: 'lako.services',
            clientRequestHTTPMethodName: 'POST',
            clientRequestPath: '/api/efaktura/generate',
            edgeResponseStatus: 200,
          },
        },
      ]),
    }),
  );

  assert.equal(report.summary.status, 'CRITICAL');
  assert.deepEqual(report.summary.criticalReasons, ['unexpected-post-2xx=7']);
  assert.match(
    report.message,
    /unexpected POST 2xx details: \/api\/efaktura\/generate · 200 × 7/,
  );
});

test('ignores successful POSTs for other hosts in the lako.services zone', () => {
  const report = buildReport(
    makeInput({
      postsRaw: postsRaw([
        {
          count: 7,
          dimensions: {
            clientRequestHTTPHost: 'bot.lako.services',
            clientRequestHTTPMethodName: 'POST',
            clientRequestPath: '/api/efaktura/generate',
            edgeResponseStatus: 200,
          },
        },
      ]),
    }),
  );

  assert.equal(report.summary.status, 'OK');
  assert.deepEqual(report.summary.criticalReasons, []);
  assert.doesNotMatch(report.message, /unexpected POST 2xx details/);
});

test('ignores successful non-POST requests on unknown routes', () => {
  const report = buildReport(
    makeInput({
      postsRaw: postsRaw([
        {
          count: 100,
          dimensions: {
            clientRequestHTTPMethodName: 'GET',
            clientRequestPath: '/graphql',
            edgeResponseStatus: 200,
          },
        },
      ]),
    }),
  );

  assert.equal(report.summary.status, 'OK');
});

test('returns ATTENTION instead of claiming OK when a required source is unavailable', () => {
  const report = buildReport(
    makeInput({ workerRaw: { monitorError: 'query_failed' } }),
  );

  assert.equal(report.summary.status, 'ATTENTION');
  assert.deepEqual(report.summary.missingChecks, ['lako.services:worker']);
  assert.match(report.message, /incomplete checks: lako\.services:worker/);
});
