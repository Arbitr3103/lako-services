import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const STATE_VERSION = 1;
const FINGERPRINT_TTL_DAYS = 7;
const MAX_FINGERPRINTS_PER_SITE = 200;
const SCANNER_ATTENTION_THRESHOLD = 100;
const MAX_UNEXPECTED_POST_DETAILS = 5;
const MAX_UNEXPECTED_POST_PATH_LENGTH = 160;
const MITIGATED_ACTIONS = new Set([
  'block',
  'challenge',
  'js_challenge',
  'managed_challenge',
]);

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function graphQlError(raw) {
  if (!raw || typeof raw !== 'object') return 'empty_response';
  if (raw.monitorError) return String(raw.monitorError);
  if (Array.isArray(raw.errors) && raw.errors.length > 0) return 'graphql_error';
  return null;
}

function parseMetrics(raw) {
  const error = graphQlError(raw);
  if (error) return { available: false, error };

  const groups = raw?.data?.viewer?.zones?.[0]?.httpRequests1dGroups;
  if (!Array.isArray(groups) || groups.length === 0) {
    return { available: false, error: 'no_data' };
  }

  const sum = groups[0]?.sum ?? {};
  const uniq = groups[0]?.uniq ?? {};
  const statuses = Object.fromEntries(
    (sum.responseStatusMap ?? []).map((entry) => [
      String(entry.edgeResponseStatus),
      asNumber(entry.requests),
    ]),
  );
  const curlPageViews = (sum.browserMap ?? [])
    .filter((entry) => String(entry.uaBrowserFamily).toLowerCase() === 'curl')
    .reduce((total, entry) => total + asNumber(entry.pageViews), 0);
  const countries = [...(sum.countryMap ?? [])]
    .sort((left, right) => asNumber(right.requests) - asNumber(left.requests))
    .slice(0, 5)
    .map((entry) => `${entry.clientCountryName} ${asNumber(entry.requests)}`);

  const fiveXx = Object.entries(statuses)
    .filter(([status]) => Number(status) >= 500 && Number(status) <= 599)
    .reduce((total, [, count]) => total + count, 0);

  return {
    available: true,
    requests: asNumber(sum.requests),
    uniques: asNumber(uniq.uniques),
    pageViews: Math.max(0, asNumber(sum.pageViews) - curlPageViews),
    threats: asNumber(sum.threats),
    bytesMb: asNumber(sum.bytes) / 1024 / 1024,
    statuses,
    fiveXx,
    countries,
  };
}

function scannerCategory(requestPath) {
  const normalized = String(requestPath || '/').toLowerCase();

  if (
    normalized.includes('/wp-') ||
    normalized.includes('wordpress') ||
    normalized.includes('phpunit') ||
    normalized.endsWith('.php')
  ) {
    return 'wordpress-php';
  }
  if (
    /(?:^|\/)(?:\.env|\.git|\.ssh)(?:\/|$)/.test(normalized) ||
    /(appspec|appsettings|buildspec|gradle\.properties|sentry|sftp-config)/.test(normalized)
  ) {
    return 'credential-config';
  }
  if (normalized.includes('graphql')) return 'graphql';
  if (normalized.includes('/debug/') || normalized.includes('/status/')) return 'debug-status';

  const segments = normalized.split('/').filter(Boolean).slice(0, 2);
  return segments.length > 0 ? `path:${segments.join('/')}` : 'root';
}

function scannerFingerprint(siteName, event) {
  const action = String(event.action ?? 'unknown').toLowerCase();
  const actionClass = MITIGATED_ACTIONS.has(action) ? 'mitigated' : action;
  const material = [
    siteName,
    event.clientIP ?? 'unknown-ip',
    scannerCategory(event.clientRequestPath),
    actionClass,
  ].join('|');
  return createHash('sha256').update(material).digest('hex').slice(0, 20);
}

function parseFirewall(raw, siteName) {
  const error = graphQlError(raw);
  if (error) return { available: false, error, events: [] };

  const events = raw?.data?.viewer?.zones?.[0]?.firewallEventsAdaptive;
  if (!Array.isArray(events)) {
    return { available: false, error: 'no_data', events: [] };
  }

  const mitigatedFingerprints = new Set();
  let mitigatedEvents = 0;
  let unmitigatedEvents = 0;

  for (const event of events) {
    const action = String(event.action ?? '').toLowerCase();
    if (MITIGATED_ACTIONS.has(action)) {
      mitigatedEvents += 1;
      mitigatedFingerprints.add(scannerFingerprint(siteName, event));
    } else {
      unmitigatedEvents += 1;
    }
  }

  return {
    available: true,
    events,
    mitigatedEvents,
    unmitigatedEvents,
    mitigatedFingerprints: [...mitigatedFingerprints],
  };
}

function normalizePostPath(requestPath) {
  const normalized = String(requestPath || '/').split('?')[0];
  return normalized || '/';
}

function normalizePostHost(requestHost) {
  return String(requestHost ?? '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

function isAllowedPostPath(requestPath, allowedPaths) {
  const normalized = normalizePostPath(requestPath);
  return allowedPaths.some((allowedPath) =>
    allowedPath.endsWith('/') ? normalized.startsWith(allowedPath) : normalized === allowedPath,
  );
}

function addPostDetail(details, requestPath, status, count) {
  const rawPath = normalizePostPath(requestPath);
  const path =
    rawPath.length > MAX_UNEXPECTED_POST_PATH_LENGTH
      ? `${rawPath.slice(0, MAX_UNEXPECTED_POST_PATH_LENGTH - 1)}…`
      : rawPath;
  const key = `${status}\u0000${rawPath}`;
  const existing = details.get(key);
  if (existing) {
    existing.count += count;
    return;
  }
  details.set(key, { path, status, count });
}

function sortedPostDetails(details) {
  return [...details.values()]
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.path.localeCompare(right.path) ||
        left.status - right.status,
    )
    .slice(0, MAX_UNEXPECTED_POST_DETAILS);
}

function parsePosts(raw, allowedPaths, expectedHost) {
  const error = graphQlError(raw);
  if (error) {
    return {
      available: false,
      error,
      unexpected2xx: 0,
      unexpectedRedirects: 0,
      rejected: 0,
      unexpected2xxDetails: [],
      unexpectedRedirectDetails: [],
    };
  }

  const groups = raw?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups;
  if (!Array.isArray(groups)) {
    return {
      available: false,
      error: 'no_data',
      unexpected2xx: 0,
      unexpectedRedirects: 0,
      rejected: 0,
      unexpected2xxDetails: [],
      unexpectedRedirectDetails: [],
    };
  }

  let unexpected2xx = 0;
  let unexpectedRedirects = 0;
  let rejected = 0;
  const unexpected2xxDetails = new Map();
  const unexpectedRedirectDetails = new Map();
  const normalizedExpectedHost = normalizePostHost(expectedHost);
  for (const group of groups) {
    const dimensions = group.dimensions ?? {};
    if (String(dimensions.clientRequestHTTPMethodName).toUpperCase() !== 'POST') continue;
    const requestHost = normalizePostHost(dimensions.clientRequestHTTPHost);
    if (requestHost && normalizedExpectedHost && requestHost !== normalizedExpectedHost) continue;
    const status = asNumber(dimensions.edgeResponseStatus);
    const count = asNumber(group.count);
    if (isAllowedPostPath(dimensions.clientRequestPath, allowedPaths)) continue;
    if (status >= 200 && status <= 299) {
      unexpected2xx += count;
      addPostDetail(unexpected2xxDetails, dimensions.clientRequestPath, status, count);
    } else if (status >= 300 && status <= 399) {
      unexpectedRedirects += count;
      addPostDetail(unexpectedRedirectDetails, dimensions.clientRequestPath, status, count);
    } else {
      rejected += count;
    }
  }

  return {
    available: true,
    unexpected2xx,
    unexpectedRedirects,
    rejected,
    unexpected2xxDetails: sortedPostDetails(unexpected2xxDetails),
    unexpectedRedirectDetails: sortedPostDetails(unexpectedRedirectDetails),
  };
}

function formatPostDetails(details) {
  return details
    .map((detail) => `${htmlEscape(detail.path)} · ${detail.status} × ${detail.count}`)
    .join('; ');
}

function parseWorker(raw) {
  const error = graphQlError(raw);
  if (error) return { available: false, error, errors: 0 };

  const groups = raw?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive;
  if (!Array.isArray(groups)) {
    return { available: false, error: 'no_data', errors: 0 };
  }

  return {
    available: true,
    errors: groups.reduce((total, group) => total + asNumber(group?.sum?.errors), 0),
  };
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function reconcileFingerprints(previousState, siteName, fingerprints, generatedAt) {
  const now = parseTimestamp(generatedAt) ?? Date.now();
  const cutoff = now - FINGERPRINT_TTL_DAYS * 24 * 60 * 60 * 1000;
  const previous = previousState?.sites?.[siteName]?.scannerFingerprints ?? {};
  const retained = Object.fromEntries(
    Object.entries(previous).filter(([, lastSeen]) => {
      const timestamp = parseTimestamp(lastSeen);
      return timestamp !== null && timestamp >= cutoff;
    }),
  );

  const newFingerprints = [];
  const repeatFingerprints = [];
  for (const fingerprint of fingerprints) {
    if (retained[fingerprint]) repeatFingerprints.push(fingerprint);
    else newFingerprints.push(fingerprint);
    retained[fingerprint] = generatedAt;
  }

  const bounded = Object.fromEntries(
    Object.entries(retained)
      .sort((left, right) => String(right[1]).localeCompare(String(left[1])))
      .slice(0, MAX_FINGERPRINTS_PER_SITE),
  );

  return { newFingerprints, repeatFingerprints, nextFingerprints: bounded };
}

function formatStatusCounts(statuses) {
  const preferred = ['200', '403', '401', '404'];
  const parts = preferred
    .filter((status) => asNumber(statuses[status]) > 0 || status === '200')
    .map((status) => `${status}:${asNumber(statuses[status])}`);
  const fiveXx = Object.entries(statuses)
    .filter(([status, count]) => Number(status) >= 500 && Number(status) <= 599 && asNumber(count) > 0)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([status, count]) => `${status}:${count}`);
  return [...parts, ...fiveXx].join(', ');
}

function formatSite(siteName, metrics) {
  if (!metrics.available) return `<b>${htmlEscape(siteName)}</b>: data unavailable`;

  const securitySignals = metrics.threats > 0 ? ` | CF signals:${metrics.threats}` : '';
  return [
    `<b>${htmlEscape(siteName)}</b>`,
    `👥 ${metrics.uniques} uniq | 📄 ${metrics.pageViews} views | 📦 ${metrics.requests} req | ${metrics.bytesMb.toFixed(1)} MB`,
    `HTTP: ${formatStatusCounts(metrics.statuses)}${securitySignals}`,
    `🌍 ${htmlEscape(metrics.countries.join(', '))}`,
  ].join('\n');
}

function normalizeState(state) {
  if (!state || state.version !== STATE_VERSION || typeof state.sites !== 'object') {
    return { version: STATE_VERSION, sites: {} };
  }
  return state;
}

export function buildReport(input, suppliedState = undefined, options = {}) {
  const previousState = normalizeState(suppliedState);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const parsedSites = input.sites.map((site) => ({
    ...site,
    metrics: parseMetrics(site.metricsRaw),
  }));
  const monitoredSite = parsedSites.find((site) => site.securityMonitored);

  const missingChecks = [];
  const criticalReasons = [];
  let securityDetails = null;
  const nextState = {
    ...previousState,
    version: STATE_VERSION,
    updatedAt: generatedAt,
    sites: { ...previousState.sites },
  };

  for (const site of parsedSites) {
    if (!site.metrics.available) missingChecks.push(`${site.name}:http`);
    if (site.metrics.available && site.metrics.fiveXx > 0) {
      criticalReasons.push(`${site.name}:5xx=${site.metrics.fiveXx}`);
    }
  }

  if (monitoredSite) {
    const firewall = parseFirewall(monitoredSite.firewallRaw, monitoredSite.name);
    const posts = parsePosts(
      monitoredSite.postsRaw,
      monitoredSite.allowedPostPaths ?? [],
      monitoredSite.postHost ?? monitoredSite.name,
    );
    const worker = parseWorker(monitoredSite.workerRaw);

    if (!firewall.available) missingChecks.push(`${monitoredSite.name}:waf`);
    if (!posts.available) missingChecks.push(`${monitoredSite.name}:posts`);
    if (!worker.available) missingChecks.push(`${monitoredSite.name}:worker`);

    if (posts.unexpected2xx > 0) {
      criticalReasons.push(`unexpected-post-2xx=${posts.unexpected2xx}`);
    }
    if (worker.errors > 0) criticalReasons.push(`worker-errors=${worker.errors}`);

    const reconciled = reconcileFingerprints(
      previousState,
      monitoredSite.name,
      firewall.mitigatedFingerprints ?? [],
      generatedAt,
    );
    nextState.sites[monitoredSite.name] = {
      scannerFingerprints: reconciled.nextFingerprints,
    };

    securityDetails = {
      metrics: monitoredSite.metrics,
      firewall,
      posts,
      worker,
      newFingerprintCount: reconciled.newFingerprints.length,
      repeatFingerprintCount: reconciled.repeatFingerprints.length,
    };
  }

  if (options.stateLoadError) missingChecks.push('state');

  let status = 'OK';
  if (criticalReasons.length > 0) status = 'CRITICAL';
  else if (
    missingChecks.length > 0 ||
    (securityDetails?.firewall?.unmitigatedEvents ?? 0) > 0 ||
    (securityDetails?.posts?.unexpectedRedirects ?? 0) > 0 ||
    ((securityDetails?.newFingerprintCount ?? 0) > 0 &&
      (securityDetails?.metrics?.threats ?? 0) >= SCANNER_ATTENTION_THRESHOLD)
  ) {
    status = 'ATTENTION';
  }

  const securityLines = [`<b>Security lako.services: ${status}</b>`];
  if (securityDetails) {
    const statusIcon = status === 'CRITICAL' ? '🚨' : status === 'ATTENTION' ? '⚠️' : '✅';
    securityLines.push(
      `🆕 blocked scanner signatures: ${securityDetails.newFingerprintCount} | repeated: ${securityDetails.repeatFingerprintCount}`,
      `🛡️ mitigated events sampled: ${securityDetails.firewall.mitigatedEvents ?? 0} | rejected suspicious POST: ${securityDetails.posts.rejected ?? 0}`,
      `${statusIcon} 5xx: ${securityDetails.metrics.fiveXx ?? 0} | Worker errors: ${securityDetails.worker.errors ?? 0} | unexpected POST 2xx: ${securityDetails.posts.unexpected2xx ?? 0} | unknown POST redirects: ${securityDetails.posts.unexpectedRedirects ?? 0}`,
    );
    if (securityDetails.posts.unexpected2xxDetails.length > 0) {
      securityLines.push(`🚨 unexpected POST 2xx details: ${formatPostDetails(securityDetails.posts.unexpected2xxDetails)}`);
    }
    if (securityDetails.posts.unexpectedRedirectDetails.length > 0) {
      securityLines.push(`⚠️ unknown POST redirect details: ${formatPostDetails(securityDetails.posts.unexpectedRedirectDetails)}`);
    }
  }
  if (missingChecks.length > 0) {
    securityLines.push(`⚠️ incomplete checks: ${htmlEscape(missingChecks.join(', '))}`);
  }

  const db = input.database ?? {};
  const message = [
    `📊 <b>Analytics ${htmlEscape(input.date)}</b>`,
    securityLines.join('\n'),
    ...parsedSites.map((site) => formatSite(site.name, site.metrics)),
    `<b>БД echain</b>\n👤 +${htmlEscape(db.echainNewUsers ?? 'ERR')} users (всего ${htmlEscape(db.echainTotalUsers ?? 'ERR')}) | 📄 +${htmlEscape(db.echainNewDocs ?? 'ERR')} docs (всего ${htmlEscape(db.echainTotalDocs ?? 'ERR')}) | 🚛 +${htmlEscape(db.echainNewTrips ?? 'ERR')} trips`,
    `<b>e-Faktura</b>\n📄 +${htmlEscape(db.efakturaNew ?? 'ERR')} invoices | 📝 ${htmlEscape(db.efakturaAudit ?? 'ERR')} audit events`,
  ].join('\n\n');

  return {
    message,
    nextState,
    summary: {
      status,
      criticalReasons,
      missingChecks,
      newScannerFingerprints: securityDetails?.newFingerprintCount ?? 0,
      repeatedScannerFingerprints: securityDetails?.repeatFingerprintCount ?? 0,
    },
  };
}

function parseArgs(argv) {
  const command = argv[2];
  const values = {};
  for (let index = 3; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? '<end>'}`);
    }
    values[key.slice(2)] = value;
  }
  return { command, values };
}

function readState(stateFile) {
  if (!fs.existsSync(stateFile)) return { state: undefined, error: null };
  try {
    return { state: JSON.parse(fs.readFileSync(stateFile, 'utf8')), error: null };
  } catch {
    return { state: undefined, error: 'invalid_state' };
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

function runCli() {
  const { command, values } = parseArgs(process.argv);
  if (command === 'render') {
    if (!values.input || !values['state-file'] || !values.output) {
      throw new Error('render requires --input, --state-file, and --output');
    }
    const input = JSON.parse(fs.readFileSync(values.input, 'utf8'));
    const loaded = readState(values['state-file']);
    const report = buildReport(input, loaded.state, { stateLoadError: loaded.error });
    writeJsonAtomic(values.output, report);
    return;
  }
  if (command === 'commit') {
    if (!values.result || !values['state-file']) {
      throw new Error('commit requires --result and --state-file');
    }
    const result = JSON.parse(fs.readFileSync(values.result, 'utf8'));
    writeJsonAtomic(values['state-file'], result.nextState);
    return;
  }
  throw new Error(`Unknown command: ${command ?? '<none>'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
