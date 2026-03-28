import { HttpErrorResponse } from '@angular/common/http';

interface ApiErrorShape {
  status?: number;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export function extractApiErrorMessage(error: HttpErrorResponse, fallback: string): string {
  const payload = error.error as ApiErrorShape | undefined;

  if (payload?.fieldErrors && Object.keys(payload.fieldErrors).length > 0) {
    return Object.values(payload.fieldErrors).join(' | ');
  }

  if (payload?.message && payload.message.trim().length > 0) {
    return payload.message;
  }

  switch (error.status) {
    case 401:
      return 'Session invalide ou identifiants incorrects.';
    case 403:
      return 'Accès refusé pour cette action.';
    case 409:
      return 'Conflit de données. Vérifiez les informations saisies.';
    case 422:
      return 'Données invalides. Merci de corriger le formulaire.';
    default:
      return fallback;
  }
}
