import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  AuthService,
  PendingSocialRegistration,
  SocialProvider,
} from '../../../core/auth/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { NavbarComponent } from "../../ui/navbar/navbar.component";
import { GoogleLoginProvider, SocialAuthService, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, RouterModule, GoogleSigninButtonModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('authCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  registerData = {
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    surname: '',
    avatarUrl: ''
  };

  isSocialRegistration = false;
  showPassword = false;
  socialProvider: SocialProvider | null = null;
  oauthRegistrationToken: string | null = null;
  private googleLoginInProgress = false;
  private returnUrl: string = '/';
  private animFrameId: number | null = null;
  private nodes: any[] = [];

  constructor(
    private authService: AuthService,
    private alertService: AlertService,
    private router: Router,
    private route: ActivatedRoute,
    private socialAuthService: SocialAuthService,
    private ngZone: NgZone
  ) {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { socialData?: PendingSocialRegistration } | undefined;

    if (state?.socialData) {
      this.handleSocialData(state.socialData);
    }
  }

  ngOnInit(): void {
    this.returnUrl = this.authService.sanitizeReturnUrl(this.route.snapshot.queryParams['returnUrl'] || '/');
    const requestedSocialProvider = this.route.snapshot.queryParams['social'];

    if ((requestedSocialProvider === 'google' || requestedSocialProvider === 'github') && !this.isSocialRegistration) {
      const pendingSocialRegistration = this.authService.getPendingSocialRegistration();

      if (pendingSocialRegistration && pendingSocialRegistration.provider === requestedSocialProvider) {
        const socialRegistration = pendingSocialRegistration;
        this.handleSocialData(socialRegistration);
      } else {
        this.alertService.error('Sessione social scaduta. Riprova con il provider scelto.');
        this.router.navigate(['/register'], { queryParams: { returnUrl: this.returnUrl } });
      }
    }

    this.socialAuthService.authState.subscribe((user) => {
      if (user && user.idToken && !this.googleLoginInProgress && !this.authService.IsAuthenticated()) {
        this.googleLoginInProgress = true;
        this.authService.LoginWithGoogle(user.idToken).subscribe({
          next: (res) => {
            if (res.needsRegistration && res.userData && res.registrationToken) {
              this.alertService.success('Profilo caricato da Google!');
              this.handleSocialData({
                ...res.userData,
                provider: res.userData.provider || 'google',
                registrationToken: res.registrationToken
              });
            } else if (res.token) {
              this.alertService.success('Accesso effettuato con successo!');
              this.authService.saveAuth(res.token);
              this.router.navigateByUrl(this.returnUrl);
            }
            this.googleLoginInProgress = false;
          },
          error: (err) => {
            this.alertService.error('Errore durante il caricamento da Google');
            this.googleLoginInProgress = false;
          }
        });
      }
    });
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.initBackground();
      this.animate();
    });

    window.addEventListener('resize', () => this.initBackground());
  }

  ngOnDestroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  private initBackground() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    this.nodes = [];
    const nodeCount = Math.floor((canvas.width * canvas.height) / 25000) + 15;

    for (let i = 0; i < nodeCount; i++) {
      this.nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1
      });
    }
  }

  private animate() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Major city points (normalized 0-1)
    const cities = [
      { x: 0.2, y: 0.3 }, { x: 0.5, y: 0.2 }, { x: 0.8, y: 0.4 },
      { x: 0.3, y: 0.7 }, { x: 0.6, y: 0.6 }, { x: 0.9, y: 0.8 },
      { x: 0.1, y: 0.6 }, { x: 0.4, y: 0.5 }, { x: 0.7, y: 0.2 }
    ];

    const routes: any[] = [];
    for (let i = 0; i < 15; i++) {
      routes.push({
        from: cities[Math.floor(Math.random() * cities.length)],
        to: cities[Math.floor(Math.random() * cities.length)],
        progress: Math.random(),
        speed: 0.001 + Math.random() * 0.002,
        opacity: 0.2 + Math.random() * 0.3
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw routes
      routes.forEach(r => {
        r.progress += r.speed;
        if (r.progress > 1) {
          r.progress = 0;
          r.from = cities[Math.floor(Math.random() * cities.length)];
          r.to = cities[Math.floor(Math.random() * cities.length)];
        }

        const x1 = r.from.x * canvas.width;
        const y1 = r.from.y * canvas.height;
        const x2 = r.to.x * canvas.width;
        const y2 = r.to.y * canvas.height;

        const cpX = (x1 + x2) / 2;
        const cpY = Math.min(y1, y2) - 50;

        // Path
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpX, cpY, x2, y2);
        ctx.strokeStyle = `rgba(139, 92, 246, ${r.opacity * 0.2})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Moving dot
        const t = r.progress;
        const cx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpX + t * t * x2;
        const cy = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpY + t * t * y2;

        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(147, 197, 253, ${r.opacity})`;
        ctx.fill();

        // Glow
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6);
        glow.addColorStop(0, `rgba(139, 92, 246, ${r.opacity * 0.5})`);
        glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
      });

      this.animFrameId = requestAnimationFrame(draw);
    };

    draw();
  }

  private handleSocialData(data: PendingSocialRegistration) {
    this.isSocialRegistration = true;
    this.socialProvider = data.provider;
    this.oauthRegistrationToken = data.registrationToken;
    this.authService.savePendingSocialRegistration(data);
    this.registerData.email = data.email;
    this.registerData.name = data.name || '';
    this.registerData.surname = data.surname || '';
    this.registerData.avatarUrl = data.avatarUrl || '';
  }

  startGithubRegistration() {
    this.authService.startGithubAuth('register', this.returnUrl);
  }

  async goToLogin() {
    try {
      await this.socialAuthService.signOut();
    } catch (e) { }
    this.authService.clearPendingSocialRegistration();
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.returnUrl } });
  }

  onSubmit() {
    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.alertService.error('Le password non corrispondono');
      return;
    }

    if (this.registerData.password.length < 6) {
      this.alertService.error('La password deve essere di almeno 6 caratteri');
      return;
    }

    const { confirmPassword, ...data } = this.registerData;
    const finalData = {
      ...data,
      authProvider: this.socialProvider ?? 'local',
      oauthRegistrationToken: this.oauthRegistrationToken ?? undefined
    };

    this.authService.Register(finalData).subscribe({
      next: (res) => {
        this.authService.clearPendingSocialRegistration();

        if (this.isSocialRegistration) {
          this.alertService.success('Registrazione completata! Ora puoi effettuare il login.');
        } else {
          this.alertService.success('Registrazione completata! Controlla la tua email per verificare l\'account.');
        }
        this.router.navigate(['/login'], { queryParams: { returnUrl: this.returnUrl } });
      },
      error: (err) => {
        let errorMessage = 'Errore durante la registrazione';
        if (err.error?.details && Array.isArray(err.error.details) && err.error.details.length > 0) {
          errorMessage = err.error.details.map((d: any) => d.message).join(', ');
        } else if (err.error?.error) {
          errorMessage = err.error.error;
        } else if (err.error?.message) {
          errorMessage = err.error.message;
        }
        this.alertService.error(errorMessage);
      }
    });
  }
}
