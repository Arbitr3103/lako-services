import { defineMiddleware } from 'astro:middleware';
import { shouldRedirectToTrailingSlash, toTrailingSlashPath } from './utils/url';

export const onRequest = defineMiddleware(async (context, next) => {
  const redirectUrl = new URL(context.url);
  const shouldRedirectToHttps = redirectUrl.hostname === 'lako.services' && redirectUrl.protocol !== 'https:';
  const shouldRedirectPath = shouldRedirectToTrailingSlash(context.url.pathname);

  if (shouldRedirectToHttps || shouldRedirectPath) {
    if (shouldRedirectToHttps) {
      redirectUrl.protocol = 'https:';
    }

    if (shouldRedirectPath) {
      redirectUrl.pathname = toTrailingSlashPath(context.url.pathname);
    }

    return Response.redirect(redirectUrl, 308);
  }

  const response = await next();
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  // CSP handled by Astro experimental.csp (hash-based, via <meta> tag)
  // frame-ancestors not supported in <meta> CSP — X-Frame-Options: DENY above covers it
  // Static asset caching handled by public/_headers (CF Workers Assets)
  return response;
});
