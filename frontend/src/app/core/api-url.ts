/**
 * Base URL for HTTP API calls.
 * Use empty string so requests stay same-origin (e.g. http://localhost:4200/api/...).
 * `ng serve` proxies /api and /uploads to the backend (see src/proxy.conf.json).
 */
export const API_BASE_URL = '';

/** Si le proxy n’est pas actif, repli possible vers l’API directe (CORS activé côté backend). */
export const API_FALLBACK_ORIGIN = 'http://localhost:8081';
