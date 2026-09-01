import { pathToFileURL } from 'node:url';

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_MIN_BYTES = 10_000;
const DEFAULT_RETRY_DELAY_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 10_000;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function validateIdentityResponse({ body, minBytes = DEFAULT_MIN_BYTES, response, url }) {
  assert(response.status === 200, `${url}: expected HTTP 200, got ${response.status}`);

  const contentType = response.headers.get('content-type') ?? '';
  assert(contentType.toLowerCase().includes('text/html'), `${url}: expected text/html, got ${contentType || 'missing'}`);

  const contentEncoding = response.headers.get('content-encoding');
  assert(
    contentEncoding === null || contentEncoding.toLowerCase() === 'identity',
    `${url}: identity request unexpectedly returned content-encoding ${contentEncoding}`,
  );

  const bytes = Buffer.byteLength(body, 'utf8');
  assert(bytes >= minBytes, `${url}: response is too short (${bytes} bytes; expected at least ${minBytes})`);
  assert(body.trimEnd().endsWith('</html>'), `${url}: response did not deliver the closing </html> tag`);

  return { bytes, contentType };
}

export async function checkIdentityResponse(
  url,
  {
    fetchImpl = globalThis.fetch,
    minBytes = DEFAULT_MIN_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  const target = new URL(url).href;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs);

  try {
    const response = await fetchImpl(target, {
      headers: {
        accept: 'text/html',
        'accept-encoding': 'identity',
        'user-agent': 'lako-identity-response-smoke/1.0',
      },
      redirect: 'manual',
      signal: controller.signal,
    });
    const body = await response.text();
    return validateIdentityResponse({ body, minBytes, response, url: target });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${target}: identity response timed out after ${timeoutMs} ms`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function runIdentityResponseSmoke(
  urls,
  {
    attempts = DEFAULT_ATTEMPTS,
    fetchImpl = globalThis.fetch,
    minBytes = DEFAULT_MIN_BYTES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    sleep = delay,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  assert(Array.isArray(urls) && urls.length > 0, 'Pass at least one URL to the identity-response smoke.');
  assert(Number.isInteger(attempts) && attempts > 0, 'attempts must be a positive integer');

  const results = [];

  for (const url of urls) {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const result = await checkIdentityResponse(url, { fetchImpl, minBytes, timeoutMs });
        results.push({ ...result, attempt, url: new URL(url).href });
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          console.warn(`Identity response attempt ${attempt}/${attempts} failed for ${url}: ${formatError(error)}`);
          await sleep(retryDelayMs);
        }
      }
    }

    if (lastError) {
      throw new Error(`${url}: identity-response smoke failed after ${attempts} attempts: ${formatError(lastError)}`, {
        cause: lastError,
      });
    }
  }

  return results;
}

async function main() {
  const urls = process.argv.slice(2);
  const results = await runIdentityResponseSmoke(urls);

  for (const result of results) {
    console.log(`Identity response complete: ${result.url} (${result.bytes} bytes, attempt ${result.attempt}).`);
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    console.error(`Identity-response smoke failed: ${formatError(error)}`);
    process.exitCode = 1;
  });
}
