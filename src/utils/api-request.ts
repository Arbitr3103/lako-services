const JSON_CONTENT_TYPE = 'application/json';

export type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; response: Response };

export function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  return value.split(';', 1)[0].trim().toLowerCase() === JSON_CONTENT_TYPE;
}

function getContentLength(request: Request): number | null {
  const value = request.headers.get('Content-Length');
  if (!value) return null;

  const size = Number(value);
  if (!Number.isSafeInteger(size) || size < 0) return -1;
  return size;
}

async function readLimitedText(request: Request, maxBytes: number): Promise<string | Response> {
  const declaredLength = getContentLength(request);
  if (declaredLength === -1) {
    return jsonResponse({ error: 'Invalid Content-Length' }, 400);
  }
  if (declaredLength !== null && declaredLength > maxBytes) {
    return jsonResponse({ error: 'Request body too large' }, 413);
  }

  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      return jsonResponse({ error: 'Request body too large' }, 413);
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

export async function parseLimitedJson(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  if (!isJsonContentType(request.headers.get('Content-Type'))) {
    return { ok: false, response: jsonResponse({ error: 'Unsupported content type' }, 415) };
  }

  const body = await readLimitedText(request, maxBytes);
  if (body instanceof Response) {
    return { ok: false, response: body };
  }

  try {
    return { ok: true, data: JSON.parse(body) };
  } catch {
    return { ok: false, response: jsonResponse({ error: 'Invalid request' }, 400) };
  }
}
