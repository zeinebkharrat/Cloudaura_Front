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

  // Spring {@code ApiResponse.error(...)} body: { success: false, message, code, status }
  const apiLike = error.error as { success?: boolean; message?: string; errorCode?: string; code?: string } | undefined;
  if (apiLike?.success === false && apiLike.message && apiLike.message.trim().length > 0) {
    return apiLike.message.trim();
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
      return 'invalid_credentials';
    case 403:
      return 'access_denied';
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

export function isBackendLoginRedirectError(error: HttpErrorResponse): boolean {
  const targetUrl = (error.url ?? '').toLowerCase();
  const msg = (error.message ?? '').toLowerCase();

  if (targetUrl.includes('/login')) {
    return true;
  }

  if (error.status === 0 && msg.includes('unknown error')) {
    return true;
  }

  return false;
}
