import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthResponse } from '../models/response.model';
import { HttpClient } from '@angular/common/http';
import { SHA256 } from 'crypto-js';
import { environment } from '../../../environments/environment';

export type SocialProvider = 'google' | 'github';
export type SocialAuthMode = 'login' | 'register';

export interface PendingSocialRegistration {
  email: string;
  name?: string;
  surname?: string;
  avatarUrl?: string;
  provider: SocialProvider;
  registrationToken: string;
}

@Injectable({
  providedIn: 'root',
})

export class AuthService {
  private readonly TOKEN_KEY = 'authToken';
  private readonly PENDING_SOCIAL_REGISTRATION_KEY = 'pendingSocialRegistration';

  private readonly tokenSignal = signal<string | null>(null);

  private AUTH_URL = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {
    const token = localStorage.getItem(this.TOKEN_KEY);

    if (token && !this.isTokenExpired(token)) {
      this.tokenSignal.set(token);
    } else if (token) {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }

  saveAuth(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.tokenSignal.set(token);
  }

  Logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem('sf_itinerary_draft');
    this.tokenSignal.set(null);
  }

  IsAuthenticated(): boolean {
    const token = this.tokenSignal();
    return !!token && !this.isTokenExpired(token);
  }

  getAccessToken(): string | null {
    const token = this.tokenSignal();
    if (!token || this.isTokenExpired(token)) return null;
    return token;
  }

  sanitizeReturnUrl(returnUrl: string | null | undefined): string {
    if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
      return '/';
    }

    return returnUrl;
  }

  startGithubAuth(mode: SocialAuthMode, returnUrl = '/'): void {
    const safeReturnUrl = this.sanitizeReturnUrl(returnUrl);
    const params = new URLSearchParams({
      mode,
      returnUrl: safeReturnUrl,
    });

    window.location.href = `${this.AUTH_URL}/github?${params.toString()}`;
  }

  savePendingSocialRegistration(data: PendingSocialRegistration): void {
    sessionStorage.setItem(this.PENDING_SOCIAL_REGISTRATION_KEY, JSON.stringify(data));
  }

  getPendingSocialRegistration(): PendingSocialRegistration | null {
    const rawValue = sessionStorage.getItem(this.PENDING_SOCIAL_REGISTRATION_KEY);

    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<PendingSocialRegistration>;

      if (
        typeof parsed.email !== 'string' ||
        typeof parsed.registrationToken !== 'string' ||
        (parsed.provider !== 'google' && parsed.provider !== 'github')
      ) {
        this.clearPendingSocialRegistration();
        return null;
      }

      return {
        email: parsed.email,
        name: parsed.name,
        surname: parsed.surname,
        avatarUrl: parsed.avatarUrl,
        provider: parsed.provider,
        registrationToken: parsed.registrationToken,
      };
    } catch (error) {
      this.clearPendingSocialRegistration();
      return null;
    }
  }

  clearPendingSocialRegistration(): void {
    sessionStorage.removeItem(this.PENDING_SOCIAL_REGISTRATION_KEY);
  }

  getUserData(): any {
    if (!this.IsAuthenticated()) return null;

    try {
      const parts = this.tokenSignal()!.split('.');
      if (parts.length !== 3) return null;

      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4;
      if (pad) {
        if (pad === 1) throw new Error('Invalid base64 string');
        base64 += new Array(5 - pad).join('=');
      }

      const decoded = JSON.parse(atob(base64));
      return decoded;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;

      const decoded = JSON.parse(atob(parts[1]));

      if (!decoded.exp) return false;

      const expirationTime = decoded.exp * 1000;
      return Date.now() >= expirationTime;
    } catch (error) {
      return true;
    }
  }

  Login(email: string, password: string): Observable<AuthResponse> {
    const hashedPassword = SHA256(password).toString();
    return this.http.post<any>(this.AUTH_URL + '/login', { email, password: hashedPassword });
  }

  LoginWithGoogle(idToken: string): Observable<AuthResponse> {
    return this.http.post<any>(this.AUTH_URL + "/google", { idToken });
  }

  Register(data: any): Observable<any> {
    const dataWithHashedPassword = {
      ...data,
      password: SHA256(data.password).toString(),
    };
    return this.http.post<any>(this.AUTH_URL + '/register', dataWithHashedPassword);
  }

  ForgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.AUTH_URL}/forgot-password`, { email });
  }

  ResetPassword(token: string, password: string): Observable<any> {
    const hashedPassword = SHA256(password).toString();
    return this.http.post<any>(`${this.AUTH_URL}/reset-password`, { token, newPassword: hashedPassword });
  }

  VerifyEmail(token: string): Observable<any> {
    return this.http.post<any>(`${this.AUTH_URL}/verify-email`, { token });
  }
}


