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

export const NETWORK_ERROR =
  'Could not reach the server. Check your connection and try again.';

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

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    // fetch only rejects when the request never got an answer — offline, DNS,
    // CORS, server down. Its message ("Failed to fetch") is not for users.
    throw new ApiClientError(0, NETWORK_ERROR);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
    throw new ApiClientError(res.status, body.error ?? res.statusText, body.requestId);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
};
