const LEGACY_KEY = 'yalla_questionnaire_done';

function keyForUser(userId: number | null | undefined): string | null {
  if (userId == null || Number.isNaN(Number(userId))) {
    return null;
  }
  return `yalla_questionnaire_done_u${userId}`;
}

/** Supprime l’ancien flag global (une seule valeur pour tous) pour éviter les blocages. */
export function clearLegacyQuestionnaireFlag(): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  sessionStorage.removeItem(LEGACY_KEY);
}

export function isQuestionnaireDoneForCurrentUser(userId: number | null | undefined): boolean {
  if (typeof sessionStorage === 'undefined') {
    return false;
  }
  const scopedKey = keyForUser(userId);
  if (scopedKey) {
    const v = sessionStorage.getItem(scopedKey);
    if (v === 'true' || v === '1') {
      return true;
    }
  }
  return false;
}

export function markQuestionnaireDoneForUser(userId: number | null | undefined): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  const scopedKey = keyForUser(userId);
  if (scopedKey) {
    sessionStorage.setItem(scopedKey, 'true');
  }
  sessionStorage.removeItem(LEGACY_KEY);
}
