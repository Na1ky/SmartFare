import { Component, OnInit, inject, AfterViewInit, OnDestroy, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { NavbarComponent } from "../../ui/navbar/navbar.component";

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.css']
})
export class VerifyEmailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('authCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private ngZone = inject(NgZone);

  isLoading = true;
  error: string | null = null;
  success = false;
  private animFrameId: number | null = null;
  private nodes: any[] = [];

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      
      if (!token) {
        this.error = 'Token di verifica mancante.';
        this.isLoading = false;
        return;
      }

      this.verifyToken(token);
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
    if (!this.canvasRef) return;
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
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpX, cpY, x2, y2);
        ctx.strokeStyle = `rgba(139, 92, 246, ${r.opacity * 0.2})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        const t = r.progress;
        const cx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpX + t * t * x2;
        const cy = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpY + t * t * y2;

        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(147, 197, 253, ${r.opacity})`;
        ctx.fill();

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

  private verifyToken(token: string): void {
    this.authService.VerifyEmail(token).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.success = true;
        
        if (response.token) {
          this.authService.saveAuth(response.token);
        }

        setTimeout(() => {
          this.router.navigate(['/']);
        }, 3000);
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err.error?.message || 'Si è verificato un errore durante la verifica. Il link potrebbe essere scaduto.';
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}

