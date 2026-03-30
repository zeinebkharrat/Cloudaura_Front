/** Base URL vide = requêtes relatives (`/api/...`) via le proxy Angular → backend. */
export const API_BASE_URL = '';

/**
 * Origine backend directe pour secours (ex. proxy mal configuré).
 * Doit correspondre à `server.port` dans application.properties (souvent 9091).
 */
export const API_FALLBACK_ORIGIN = 'http://localhost:9091';
