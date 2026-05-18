import { Injectable } from '@angular/core';

const KEY_CONSENT = 'sf_cookie_consent';
const KEY_PREFS   = 'sf_cookie_prefs';

export interface CookiePrefs {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

@Injectable({ providedIn: 'root' })
export class CookieConsentService {

  hasConsented(): boolean {
    return this.getCookie(KEY_CONSENT) !== null;
  }

  getPreferences(): CookiePrefs | null {
    const raw = this.getCookie(KEY_PREFS);
    if (!raw) return null;
    try { return JSON.parse(decodeURIComponent(raw)); } catch { return null; }
  }

  acceptAll(): void {
    this.savePreferences({ necessary: true, functional: true, analytics: true, marketing: true });
  }

  rejectAll(): void {
    this.savePreferences({ necessary: true, functional: false, analytics: false, marketing: false });
  }

  savePreferences(prefs: CookiePrefs): void {
    this.setCookie(KEY_PREFS, encodeURIComponent(JSON.stringify(prefs)), 365);
    this.setCookie(KEY_CONSENT, 'done', 365);
  }

  clearConsent(): void {
    this.setCookie(KEY_CONSENT, '', -1);
    this.setCookie(KEY_PREFS, '', -1);
  }

  private setCookie(name: string, value: string, days: number): void {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
  }

  private getCookie(name: string): string | null {
    const match = document.cookie.split('; ').find(c => c.startsWith(name + '='));
    return match ? decodeURIComponent(match.split('=')[1]) : null;
  }
}
