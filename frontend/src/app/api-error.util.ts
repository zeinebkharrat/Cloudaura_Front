import { HttpErrorResponse } from '@angular/common/http';

interface ApiErrorShape {
  status?: number;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export function extractApiErrorMessage(error: HttpErrorResponse, fallback: string): string {
  if (typeof error.error === 'string' && error.error.trim().length > 0) {
    return error.error.trim();
  }

  const payload = error.error as ApiErrorShape | undefined;

  if (payload?.fieldErrors && Object.keys(payload.fieldErrors).length > 0) {
    return Object.values(payload.fieldErrors).join(' | ');
  }

  if (payload?.message && payload.message.trim().length > 0) {
    return payload.message;
  }

  // Corps JSON (ex. ApiResponse) parfois sous error.error
  const nested = (error.error as { error?: { message?: string } })?.error;
  if (nested?.message && nested.message.trim().length > 0) {
    return nested.message;
  }

  switch (error.status) {
    case 401:
      return 'Invalid session or incorrect credentials.';
    case 403:
      return 'Access denied for this action.';
    case 409:
      return 'Data conflict. Please check the information you entered.';
    case 422:
      return 'Invalid data. Please correct the form.';
    case 502:
    case 503:
      return 'Service temporarily unavailable. Please try again shortly.';
    default:
      return fallback;
  }
}
