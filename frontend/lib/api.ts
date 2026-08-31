import type { ApiError } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Thin fetch wrapper — no axios needed. Pass the Clerk session token from the
 * caller (getToken() in the browser, auth() on the server) rather than reading
 * it here, so this stays usable from both.
 */
export const apiFetch = async <T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> => {
  const { token, headers, ...init } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
    throw new ApiClientError(res.status, body.error ?? res.statusText, body.requestId);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
};
