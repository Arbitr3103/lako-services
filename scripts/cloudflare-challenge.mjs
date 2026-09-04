const CHALLENGE_HEADER = 'cf-mitigated';
const CHALLENGE_VALUE = 'challenge';
const PRODUCTION_HOST = 'lako.services';

export function isProductionCloudflareChallenge(response, url) {
  const target = new URL(url);

  return (
    target.protocol === 'https:' &&
    target.hostname === PRODUCTION_HOST &&
    response.status !== 200 &&
    response.headers.get(CHALLENGE_HEADER)?.toLowerCase() === CHALLENGE_VALUE
  );
}
