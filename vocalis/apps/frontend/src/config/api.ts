/**
 * Resolves the API base URL dynamically based on environment:
 * - In development: uses VITE_API_BASE_URL if set, or defaults to http://localhost:3001
 * - In production: uses VITE_API_BASE_URL if set; if empty or unset, automatically resolves to window.location.origin
 *   (matching the Azure App Service host domain without hardcoding)
 */
function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;

  // 1. If explicit env variable is provided and non-empty, honor it
  if (typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 2. In browser runtime
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    // Under Vite dev server (typically port 5173), fallback to backend port 3001
    if (import.meta.env.DEV && window.location.port === '5173') {
      return 'http://localhost:3001';
    }
    // In production, served alongside Express on the same origin
    return window.location.origin.replace(/\/+$/, '');
  }

  return 'http://localhost:3001';
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Returns the WebSocket URL for a given path:
 * Automatically converts http:// -> ws:// and https:// -> wss://
 */
export function getWebSocketUrl(path: string = '/api/sessions/live-stream'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = API_BASE_URL.replace(/^http/, 'ws');
  return `${base.replace(/\/+$/, '')}${cleanPath}`;
}

