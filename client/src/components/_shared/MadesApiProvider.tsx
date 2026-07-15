// =============================================================================
// MADES API Provider — 全局注入 JWT token 到 /api/ 请求
// 放到 LibreChat Router 内即可生效，无需修改各组件
// =============================================================================
import { useEffect, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

// 保存原始 fetch
const originalFetch = window.fetch.bind(window);

/**
 * 自动给 /api/ 请求加上 Authorization header
 */
function madesFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = request.url;

  // 只拦截 /api/ 开头的请求（同源）
  if (url.startsWith('/api/') || url.includes('/api/')) {
    try {
      const token = localStorage.getItem('madesToken');
      if (token) {
        const headers = new Headers(request.headers);
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        return originalFetch(request, { ...init, headers });
      }
    } catch { /* localStorage 不可用 */ }
  }

  return originalFetch(request, init);
}

export default function MadesApiProvider({ children }: Props) {
  useEffect(() => {
    // 运行期间覆盖 fetch
    window.fetch = madesFetch as typeof window.fetch;

    return () => {
      // 清理时恢复
      window.fetch = originalFetch;
    };
  }, []);

  return <>{children}</>;
}
