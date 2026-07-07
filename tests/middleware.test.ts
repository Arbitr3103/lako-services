import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:middleware', () => ({
  defineMiddleware: (handler: unknown) => handler,
}));

async function runMiddleware(url: string): Promise<Response> {
  const { onRequest } = await import('../src/middleware');
  return await (onRequest as any)(
    { url: new URL(url) },
    () => Promise.resolve(new Response('ok')),
  ) as Response;
}

describe('canonical URL middleware', () => {
  it('redirects HTTP page URLs directly to the HTTPS trailing-slash canonical URL', async () => {
    const response = await runMiddleware('http://lako.services/cookie-policy');

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://lako.services/cookie-policy/');
  });

  it('redirects production HTTP URLs that already have a trailing slash to HTTPS', async () => {
    const response = await runMiddleware('http://lako.services/cookie-policy/');

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://lako.services/cookie-policy/');
  });

  it('keeps localhost redirects on HTTP for local development', async () => {
    const response = await runMiddleware('http://localhost:4321/cookie-policy');

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('http://localhost:4321/cookie-policy/');
  });
});
