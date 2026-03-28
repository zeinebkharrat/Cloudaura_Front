/**
 * Base URL for HTTP API calls.
 * Use empty string so requests stay same-origin (e.g. http://localhost:4200/api/...).
 * `ng serve` proxies /api to the backend (see src/proxy.conf.json).
 */
export const API_BASE_URL = '';

/**
 * Direct backend origin for emergency fallback only (e.g. proxy misconfigured).
 * Must match `server.port` in backend application.properties (default 9091).
 */
export const API_FALLBACK_ORIGIN = 'http://localhost:9091';
