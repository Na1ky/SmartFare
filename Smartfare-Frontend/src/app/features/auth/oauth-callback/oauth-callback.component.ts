import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthService,
  PendingSocialRegistration,
  SocialProvider,
} from '../../../core/auth/auth.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="oauth-callback-page">
      <div class="oauth-callback-card">
        <div class="spinner" aria-hidden="true"></div>
        <h1>Connessione in corso</h1>
        <p>{{ statusMessage }}</p>
      </div>
    </div>
  `,
  styles: `
    .oauth-callback-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background:
        radial-gradient(circle at top, rgba(124, 58, 237, 0.22), transparent 40%),
        linear-gradient(180deg, #020617 0%, #081122 100%);
    }

    .oauth-callback-card {
      width: min(100%, 420px);
      padding: 36px 28px;
      border-radius: 24px;
      text-align: center;
      color: white;
      background: rgba(11, 9, 20, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.18);
      box-shadow: 0 24px 60px rgba(2, 6, 23, 0.45);
    }

    .oauth-callback-card h1 {
      margin: 0 0 12px;
      font-size: 1.8rem;
      font-weight: 800;
    }

    .oauth-callback-card p {
      margin: 0;
      color: rgba(226, 232, 240, 0.78);
      line-height: 1.6;
    }

    .spinner {
      width: 44px;
      height: 44px;
      margin: 0 auto 18px;
      border-radius: 50%;
      border: 4px solid rgba(148, 163, 184, 0.2);
      border-top-color: #60a5fa;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class OAuthCallbackComponent implements OnInit {
  statusMessage = "Stiamo completando l'accesso con il provider selezionato.";

  constructor(
    private authService: AuthService,
    private alertService: AlertService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.handleCallback(this.getFragmentParams());
  }

  private getFragmentParams(): URLSearchParams {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    return new URLSearchParams(hash);
  }

  private handleCallback(params: URLSearchParams): void {
    const returnUrl = this.authService.sanitizeReturnUrl(params.get('returnUrl'));
    const error = params.get('error');
    const token = params.get('token');
    const message = params.get('message');
    const needsRegistration = params.get('needsRegistration') === 'true';

    if (error) {
      this.alertService.error(error);
      this.router.navigate(['/login'], { queryParams: { returnUrl } });
      return;
    }

    if (token) {
      this.authService.saveAuth(token);
      this.alertService.success(message || 'Accesso effettuato con successo!');
      this.router.navigateByUrl(returnUrl);
      return;
    }

    if (needsRegistration) {
      const provider = params.get('provider');
      const registrationToken = params.get('registrationToken');
      const email = params.get('email');

      if (
        (provider !== 'google' && provider !== 'github') ||
        !registrationToken ||
        !email
      ) {
        this.alertService.error('Dati OAuth incompleti. Riprova.');
        this.router.navigate(['/login'], { queryParams: { returnUrl } });
        return;
      }

      const pendingRegistration: PendingSocialRegistration = {
        provider: provider as SocialProvider,
        registrationToken,
        email,
        name: params.get('name') || undefined,
        surname: params.get('surname') || undefined,
        avatarUrl: params.get('avatarUrl') || undefined,
      };

      this.authService.savePendingSocialRegistration(pendingRegistration);
      this.alertService.success('Completa la registrazione per continuare.');
      this.router.navigate(['/register'], {
        queryParams: {
          returnUrl,
          social: provider,
        },
      });
      return;
    }

    this.alertService.error('Risposta OAuth non riconosciuta. Riprova.');
    this.router.navigate(['/login'], { queryParams: { returnUrl } });
  }
}
