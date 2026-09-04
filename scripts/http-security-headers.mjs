export const EXPECTED_SECURITY_HEADERS = new Map([
  ['strict-transport-security', 'max-age=31536000; includeSubDomains; preload'],
  ['x-frame-options', 'DENY'],
  ['x-content-type-options', 'nosniff'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
  ['permissions-policy', 'camera=(), microphone=(), geolocation=()'],
  ['x-dns-prefetch-control', 'off'],
]);

export function assertExpectedSecurityHeaders(response, label) {
  for (const [name, expectedValue] of EXPECTED_SECURITY_HEADERS) {
    const actualValue = response.headers.get(name);
    if (actualValue !== expectedValue) {
      throw new Error(`Unexpected ${name} for ${label}: ${actualValue}`);
    }
  }
}
