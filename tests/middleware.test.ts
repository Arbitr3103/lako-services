import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:middleware', () => ({
  defineMiddleware: (handler: unknown) => handler,
}));

interface MiddlewareRunOptions {
  method?: string;
  headers?: HeadersInit;
}

const PAGE_POST_HEADER_CASES: Array<HeadersInit | undefined> = [
  undefined,
  { 'Content-Type': 'application/json' },
  { 'Content-Type': 'application/json', Origin: 'https://lako.services' },
];

async function runMiddleware(url: string, options: MiddlewareRunOptions = {}) {
  const { onRequest } = await import('../src/middleware');
  const next = vi.fn(() => Promise.resolve(new Response('ok')));
  const response = await (onRequest as any)(
    {
      url: new URL(url),
      request: new Request(url, {
        method: options.method ?? 'GET',
        headers: options.headers,
      }),
    },
    next,
  ) as Response;

  return { next, response };
}

describe('canonical URL middleware', () => {
  it('redirects HTTP page URLs directly to the HTTPS trailing-slash canonical URL', async () => {
    const { response } = await runMiddleware('http://lako.services/cookie-policy');

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://lako.services/cookie-policy/');
  });

  it('redirects production HTTP URLs that already have a trailing slash to HTTPS', async () => {
    const { response } = await runMiddleware('http://lako.services/cookie-policy/');

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://lako.services/cookie-policy/');
  });

  it('keeps localhost redirects on HTTP for local development', async () => {
    const { response } = await runMiddleware('http://localhost:4321/cookie-policy');

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('http://localhost:4321/cookie-policy/');
  });
});

describe('HTTP method policy middleware', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])(
    'rejects %s on ordinary pages without rendering them',
    async (method) => {
      const { next, response } = await runMiddleware('https://lako.services/', { method });

      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('GET, HEAD');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(await response.text()).toBe('');
      expect(next).not.toHaveBeenCalled();
    },
  );

  it('rejects a page POST before adding a trailing-slash redirect', async () => {
    const { next, response } = await runMiddleware('https://lako.services/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(405);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('allow')).toBe('GET, HEAD');
    expect(next).not.toHaveBeenCalled();
  });

  it.each(PAGE_POST_HEADER_CASES)('rejects page POST independently of Origin and content type', async (headers) => {
    const { next, response } = await runMiddleware('https://lako.services/', {
      method: 'POST',
      headers,
    });

    expect(response.status).toBe(405);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['/api/contact', '/api/register-business'])(
    'allows the legitimate POST endpoint %s to reach its route handler',
    async (pathname) => {
      const { next, response } = await runMiddleware(`https://lako.services${pathname}`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalledOnce();
    },
  );

  it.each(['/api/contact', '/api/register-business'])(
    'rejects unsupported methods on %s with its exact Allow header',
    async (pathname) => {
      const { next, response } = await runMiddleware(`https://lako.services${pathname}`, {
        method: 'GET',
      });

      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
      expect(next).not.toHaveBeenCalled();
    },
  );

  it('does not accept a trailing-slash variant of a POST endpoint', async () => {
    const { next, response } = await runMiddleware('https://lako.services/api/contact/', {
      method: 'POST',
    });

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['GET', 'HEAD'])('allows %s page requests to render', async (method) => {
    const { next, response } = await runMiddleware('https://lako.services/', { method });

    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledOnce();
  });
});
