import { describe, expect, it } from 'vitest';
import { POST, prerender } from '../../src/pages/api/register-business';

const validRegistration = {
  businessName: 'Audit Cafe',
  category: 'other',
  city: 'noviSad',
  address: 'Main 1',
  phone: '+381 63 123 456',
  instagram: '',
  website: 'https://example.com',
  contactName: 'Audit User',
  email: 'audit@example.com',
};

function request(headers: HeadersInit, body: string) {
  return new Request('https://lako.services/api/register-business', {
    method: 'POST',
    headers: {
      Origin: 'https://lako.services',
      ...headers,
    },
    body,
  });
}

describe('/api/register-business security handling', () => {
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

  it('fails closed when the registration secret is missing', async () => {
    const response = await POST({
      request: request({ 'Content-Type': 'application/json' }, JSON.stringify(validRegistration)),
      locals: { runtime: { env: {} } },
    } as any);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Registration service unavailable' });
  });
});
