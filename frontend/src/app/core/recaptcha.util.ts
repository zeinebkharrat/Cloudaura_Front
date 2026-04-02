/** Google reCAPTCHA v2 (checkbox) and v3 (execute) — load only one mode per page (from captcha-config). */

declare global {
  interface Window {
    grecaptcha?: {
      ready?: (callback: () => void) => void;
      render: (container: HTMLElement | string, parameters: { sitekey: string; theme?: 'light' | 'dark' }) => number;
      reset: (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
      execute?: (siteKey: string, options: { action: string }) => Promise<string>;
    };
    ___recaptchaV2Loading?: Promise<void>;
    ___recaptchaV3Loading?: Promise<void>;
    ___recaptchaV3LoadedSiteKey?: string;
  }
}

/** v2 checkbox — `api.js?render=explicit` */
export function loadRecaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
    return Promise.resolve();
  }
  if (window.___recaptchaV2Loading) {
    return window.___recaptchaV2Loading;
  }
  window.___recaptchaV2Loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-recaptcha="v2-explicit"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('reCAPTCHA script failed')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.dataset['recaptcha'] = 'v2-explicit';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('reCAPTCHA script failed'));
    document.head.appendChild(s);
  });
  return window.___recaptchaV2Loading;
}

/** v3 — `api.js?render=SITE_KEY` (required for execute(siteKey, { action })). */
export function loadRecaptchaV3Script(siteKey: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  const key = siteKey.trim();
  if (!key) {
    return Promise.reject(new Error('reCAPTCHA v3: empty site key'));
  }
  if (
    window.___recaptchaV3LoadedSiteKey === key &&
    window.grecaptcha &&
    typeof window.grecaptcha.execute === 'function'
  ) {
    return Promise.resolve();
  }
  if (window.___recaptchaV3Loading) {
    return window.___recaptchaV3Loading;
  }
  window.___recaptchaV3Loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-recaptcha-v3-site="${CSS.escape(key)}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('reCAPTCHA v3 script failed')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
    s.async = true;
    s.defer = true;
    s.dataset['recaptchaV3Site'] = key;
    s.onload = () => {
      window.___recaptchaV3LoadedSiteKey = key;
      resolve();
    };
    s.onerror = () => reject(new Error('reCAPTCHA v3 script failed'));
    document.head.appendChild(s);
  });
  return window.___recaptchaV3Loading;
}

export function executeRecaptchaV3(siteKey: string, action: string): Promise<string> {
  const gr = window.grecaptcha;
  if (!gr?.execute) {
    return Promise.reject(new Error('grecaptcha.execute not available'));
  }
  const key = siteKey.trim();
  return new Promise((resolve, reject) => {
    const run = () => {
      gr
        .execute!(key, { action })
        .then(resolve)
        .catch(reject);
    };
    if (typeof gr.ready === 'function') {
      gr.ready(run);
    } else {
      run();
    }
  });
}

export function currentRecaptchaTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') {
    return 'dark';
  }
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/**
 * Waits for the v2 API to be ready (avoids empty token races right after script load).
 */
export function renderRecaptchaInContainer(container: HTMLElement, siteKey: string): Promise<number> {
  const gr = window.grecaptcha;
  if (!gr) {
    return Promise.reject(new Error('grecaptcha not available'));
  }
  return new Promise((resolve, reject) => {
    const run = () => {
      try {
        const id = gr.render(container, {
          sitekey: siteKey,
          theme: currentRecaptchaTheme(),
        });
        resolve(id);
      } catch (e) {
        reject(e);
      }
    };
    if (typeof gr.ready === 'function') {
      gr.ready(run);
    } else {
      run();
    }
  });
}

export function getRecaptchaResponse(widgetId: number): string {
  if (!window.grecaptcha || widgetId < 0) {
    return '';
  }
  return window.grecaptcha.getResponse(widgetId) || '';
}

export function resetRecaptchaWidget(widgetId: number): void {
  if (!window.grecaptcha || widgetId < 0) {
    return;
  }
  try {
    window.grecaptcha.reset(widgetId);
  } catch {
    /* ignore */
  }
}
