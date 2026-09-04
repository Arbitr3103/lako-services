import { pathToFileURL } from 'node:url';

import { isProductionCloudflareChallenge } from './cloudflare-challenge.mjs';
import { assertExpectedSecurityHeaders } from './http-security-headers.mjs';

const HTTP_URL = 'http://lako.services/';
const HTTPS_URL = 'https://lako.services/';
const DEFAULT_TIMEOUT_MS = 10_000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function checkProductionEdge({
  allowCloudflareChallenge = false,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const redirectResponse = await fetchImpl(HTTP_URL, {
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  assert(
    [301, 308].includes(redirectResponse.status),
    `${HTTP_URL}: expected permanent HTTPS redirect, got ${redirectResponse.status}`,
  );
  assert(
    redirectResponse.headers.get('location') === HTTPS_URL,
    `${HTTP_URL}: expected Location ${HTTPS_URL}, got ${redirectResponse.headers.get('location')}`,
  );

  const httpsResponse = await fetchImpl(HTTPS_URL, {
    method: 'HEAD',
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (allowCloudflareChallenge && isProductionCloudflareChallenge(httpsResponse, HTTPS_URL)) {
    return {
      challenged: true,
      httpsStatus: httpsResponse.status,
      redirectStatus: redirectResponse.status,
    };
  }

  assert(httpsResponse.status === 200, `${HTTPS_URL}: expected direct 200, got ${httpsResponse.status}`);
  assertExpectedSecurityHeaders(httpsResponse, HTTPS_URL);

  return { httpsStatus: httpsResponse.status, redirectStatus: redirectResponse.status };
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
