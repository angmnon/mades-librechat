// =============================================================================
// MADES Auth Bridge — 自包含的 API 请求工具
// LibreChat 集成: 用户登录后 MADES token 存储在 localStorage.madesToken
// =============================================================================

const MADES_TOKEN_KEY = 'madesToken';

export function getMadesToken(): string | null {
  try {
    return localStorage.getItem(MADES_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setMadesToken(token: string): void {
  try {
    localStorage.setItem(MADES_TOKEN_KEY, token);
  } catch { /* noop */ }
}

export function clearMadesToken(): void {
  try {
    localStorage.removeItem(MADES_TOKEN_KEY);
  } catch { /* noop */ }
}

/**
 * 带 MADES JWT 的 API fetch
 * 自动从 localStorage 读取 token
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getMadesToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}
