// Thin fetch wrapper for the Strike API. Same origin in production; Vite proxies /api in dev.

const TOKEN_KEY = "strike.token";

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export const isUnauthorized = (e: unknown) => e instanceof ApiError && e.status === 401;

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode or storage disabled: the session still works until reload.
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Called on any 401 so the app can drop back to the Connect screen. */
export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Send a request to the API with the bearer token. Resolves with the raw response when it's OK; throws an
 * ApiError otherwise (and tells listeners on 401). For responses that aren't JSON, like event streams.
 */
export async function apiFetch(
  path: string,
  { method = "GET", body, signal, accept = "application/json" }: RequestOptions & { accept?: string } = {},
): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = { Accept: accept };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "Can't reach the server");
  }

  if (res.status === 401) {
    for (const l of unauthorizedListeners) l();
    throw new ApiError(401, "Unauthorized");
  }
  if (!res.ok) {
    const err = (await readJson(res)) as { error?: string; details?: unknown } | null;
    throw new ApiError(res.status, err?.error ?? `Request failed (${res.status})`, err?.details);
  }
  return res;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await apiFetch(path, options);
  return (await readJson(res)) as T;
}

/** Human message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 400 && Array.isArray(e.details) && e.details.length > 0) {
      const first = e.details[0] as { message?: string; path?: (string | number)[] };
      if (first?.message) return first.path?.length ? `${first.path.join(".")}: ${first.message}` : first.message;
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}
