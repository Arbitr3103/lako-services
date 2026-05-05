export function toTrailingSlashPath(path: string): string {
  if (!path || path === '/') return '/';
  return path.endsWith('/') ? path : `${path}/`;
}

export function shouldRedirectToTrailingSlash(pathname: string): boolean {
  if (!pathname || pathname === '/' || pathname.endsWith('/')) return false;
  if (pathname === '/api' || pathname.startsWith('/api/')) return false;

  const lastSegment = pathname.split('/').pop() ?? '';
  return !lastSegment.includes('.');
}
