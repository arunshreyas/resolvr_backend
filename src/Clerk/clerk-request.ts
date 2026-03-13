import type { Request as ExpressRequest } from 'express';

export function toStandardWebRequest(request: ExpressRequest) {
  const url = `${request.protocol}://${request.get('host')}${request.originalUrl}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(','));
      continue;
    }

    if (typeof value === 'string') {
      headers.set(key, value);
    }
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const requestWithBody = request as ExpressRequest & {
    rawBody?: Buffer;
    body?: unknown;
  };
  const rawBody =
    requestWithBody.body instanceof Buffer
      ? requestWithBody.body
      : requestWithBody.rawBody;

  return new Request(url, {
    method: request.method,
    headers,
    body: hasBody && rawBody ? new Uint8Array(rawBody) : null,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}
