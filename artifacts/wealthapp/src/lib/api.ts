export const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

let _tokenGetter: (() => Promise<string | null>) | null = null;

/** Called once from ClerkTokenSync inside ClerkProvider */
export function setTokenGetter(fn: () => Promise<string | null>) {
  _tokenGetter = fn;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const extraHeaders: Record<string, string> = {};

  if (_tokenGetter) {
    const token = await _tokenGetter();
    if (token) extraHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
      ...extraHeaders,
    },
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
