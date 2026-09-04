import { describe, expect, it } from 'vitest';
import { POST, prerender } from '../../src/pages/api/contact';

function request(headers: HeadersInit, body: string) {
  return new Request('https://lako.services/api/contact', {
    method: 'POST',
    headers: {
      Origin: 'https://lako.services',
      ...headers,
    },
    body,
  });
}

describe('/api/contact security handling', () => {
  it('remains on-demand when marketing pages are prerendered', () => {
    expect(prerender).toBe(false);
  });

  it('rejects non-JSON requests before parsing the body', async () => {
    const response = await POST({
      request: request({ 'Content-Type': 'text/plain' }, 'not-json'),
      locals: { runtime: { env: {} } },
    } as any);

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({ error: 'Unsupported content type' });
  });

  it('rejects oversized request bodies before parsing JSON', async () => {
    const response = await POST({
      request: request(
        { 'Content-Type': 'application/json', 'Content-Length': '100000' },
        JSON.stringify({ name: 'Audit', email: 'audit@example.com', message: 'hello' })
      ),
      locals: { runtime: { env: {} } },
    } as any);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: 'Request body too large' });
  });
});
