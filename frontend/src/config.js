/**
 * Single source for the backend URL. All API requests should use API_BASE or apiUrl() from here.
 * When the frontend build is served from the backend (same origin), build without setting REACT_APP_API_URL so API_BASE is ''.
 * In development with separate dev server, defaults to http://localhost:3434.
 */
const API_BASE = 'http://69.197.187.24:3434';
// const API_BASE = 'http://localhost:3434';

export { API_BASE };

/** Build full API URL from a path (e.g. apiUrl('/api/leads')). */
export function apiUrl(path) {
  const base = API_BASE.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
