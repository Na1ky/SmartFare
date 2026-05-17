import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { NavbarComponent } from "../../ui/navbar/navbar.component";

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavbarComponent],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('authCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  email: string = '';
  isSubmitting: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  private animFrameId: number | null = null;
  private nodes: any[] = [];

  constructor(
    private authService: AuthService,
    private alertService: AlertService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {}

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

  onSubmit() {
    if (!this.email) {
      this.errorMessage = "Inserisci un'email valida";
      this.alertService.error(this.errorMessage);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.authService.ForgotPassword(this.email).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (response.success) {
          this.successMessage = "Ti abbiamo inviato un'email con il link per reimpostare la password.";
          this.alertService.success(this.successMessage);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.error || "Si è verificato un errore, riprova.";
        this.alertService.error(this.errorMessage);
      }
    });
  }
}
