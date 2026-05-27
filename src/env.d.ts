/// <reference path="../.astro/types.d.ts" />

declare module 'cloudflare:workers' {
  export const env: Record<string, string | undefined>;
}
