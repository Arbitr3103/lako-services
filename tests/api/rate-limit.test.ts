import { afterEach, describe, expect, it, vi } from 'vitest';

describe('rate limiter Worker compatibility', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('does not schedule timers when constructed in module scope', async () => {
    vi.resetModules();
    const setIntervalSpy = vi.fn();
    vi.stubGlobal('setInterval', setIntervalSpy);

    const { createRateLimiter } = await import('../../src/utils/rate-limit');
    createRateLimiter({ windowMs: 10, maxRequests: 1 });

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('expires windows during subsequent requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const { createRateLimiter } = await import('../../src/utils/rate-limit');
    const limiter = createRateLimiter({ windowMs: 10, maxRequests: 1 });

    expect(limiter.isRateLimited('203.0.113.10')).toBe(false);
    expect(limiter.isRateLimited('203.0.113.10')).toBe(true);

    vi.setSystemTime(11);

    expect(limiter.isRateLimited('203.0.113.10')).toBe(false);
  });
});
