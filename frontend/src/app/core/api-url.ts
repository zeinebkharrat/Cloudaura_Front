/**
 * Base URL for HTTP API calls.
 * Use empty string so requests stay same-origin (e.g. http://localhost:4200/api/...).
 * `ng serve` proxies /api to the backend (see src/proxy.conf.json).
 * Note: `''` is falsy in JS — do not write `API_BASE_URL || API_FALLBACK_ORIGIN` or you will bypass the proxy and omit JWT on /follow, /saved-post, etc.
 */
export const API_BASE_URL = '';

/**
 * Origine backend directe pour secours (ex. proxy mal configuré).
 * Doit correspondre à `server.port` dans application.properties (souvent 9091).
 */
export const API_FALLBACK_ORIGIN = 'http://localhost:9091';
