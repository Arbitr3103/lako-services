import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

import { isProductionCloudflareChallenge } from './cloudflare-challenge.mjs';
import { IDENTITY_SMOKE_HEADERS } from './check-response-delivery.mjs';
import { assertExpectedSecurityHeaders } from './http-security-headers.mjs';

const HTTP_URL = 'http://lako.services/';
const HTTPS_URL = 'https://lako.services/';
const DEFAULT_TIMEOUT_MS = 10_000;
const CHALLENGE_ATTEMPTS = 3;
const CHALLENGE_RETRY_DELAY_MS = 2_000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function checkProductionEdge({
  allowCloudflareChallenge = false,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  sleep = delay,
  log = console.warn,
} = {}) {
  const redirectResponse = await fetchImpl(HTTP_URL, {
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  try {
    assert(
      [301, 308].includes(redirectResponse.status),
      `${HTTP_URL}: expected permanent HTTPS redirect, got ${redirectResponse.status}`,
    );
    assert(
      redirectResponse.headers.get('location') === HTTPS_URL,
      `${HTTP_URL}: expected Location ${HTTPS_URL}, got ${redirectResponse.headers.get('location')}`,
    );
  } finally {
    await redirectResponse.body?.cancel();
  }

  const attempts = allowCloudflareChallenge ? 1 : CHALLENGE_ATTEMPTS;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const httpsResponse = await fetchImpl(HTTPS_URL, {
      method: 'GET',
      headers: IDENTITY_SMOKE_HEADERS,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });

    try {
      const challenged = isProductionCloudflareChallenge(httpsResponse, HTTPS_URL);
      const rawRay = httpsResponse.headers.get('cf-ray') ?? '';
      // Headers are untrusted log input; never emit workflow commands or arbitrary text.
      const ray = /^[a-f0-9]{16,32}(?:-[a-z0-9]{3})?$/i.test(rawRay) ? rawRay : 'unavailable';
      if (challenged) {
        log(`Cloudflare challenge: ${HTTPS_URL}; attempt ${attempt}/${attempts}; HTTP ${httpsResponse.status}; Ray ID ${ray}.`);
        if (allowCloudflareChallenge) {
          return { challenged: true, httpsStatus: httpsResponse.status, redirectStatus: redirectResponse.status };
        }
      }

      const retryable = challenged && httpsResponse.status === 403 && attempt < attempts;
      if (!retryable) {
        assert(httpsResponse.status === 200, `${HTTPS_URL}: expected direct 200, got ${httpsResponse.status}; Ray ID ${ray}`);
        assertExpectedSecurityHeaders(httpsResponse, HTTPS_URL);
        return { httpsStatus: httpsResponse.status, redirectStatus: redirectResponse.status };
      }
    } finally {
      // Release before retrying; the independent full-body gate remains mandatory.
      await httpsResponse.body?.cancel();
    }

    await sleep(CHALLENGE_RETRY_DELAY_MS);
  }
  throw new Error(`${HTTPS_URL}: edge verification exhausted its attempt limit`);
}

async function main() {
  const allowCloudflareChallenge = process.argv.slice(2).includes('--allow-cloudflare-challenge');
  const result = await checkProductionEdge({ allowCloudflareChallenge });

  if (result.challenged) {
    console.warn(
      `::warning title=Cloudflare Challenge Page::Production HTTPS verification requires an external smoke: ${HTTPS_URL} returned cf-mitigated=challenge (HTTP ${result.httpsStatus}).`,
    );
    console.log(`Production edge redirect passed: HTTP ${result.redirectStatus}.`);
    return;
  }

  console.log(
    `Production edge checks passed: HTTP redirect ${result.redirectStatus}, HTTPS ${result.httpsStatus}, security headers present.`,
  );
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    console.error(`Production edge check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
