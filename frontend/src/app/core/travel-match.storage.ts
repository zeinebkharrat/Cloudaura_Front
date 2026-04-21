export const TRAVEL_PREFS_STORAGE_PREFIX = 'yalla_travel_prefs_v2_u';

export function travelPrefsStorageKey(userId: number): string {
  return `${TRAVEL_PREFS_STORAGE_PREFIX}${userId}`;
}
