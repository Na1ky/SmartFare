import { Component, OnDestroy, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertService, AlertType } from '../../../core/services/alert.service';

@Component({
  selector: 'app-alert',
  imports: [CommonModule],
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.css',
})
export class AlertComponent implements OnDestroy {
  readonly visible = signal(false);
  readonly closing = signal(false);
  readonly message = signal('');
  readonly type = signal<AlertType>('info');
  private timeoutId?: any;
  private closeTimeoutId?: any;

  constructor(
    private alertService: AlertService
  ) {
    effect(() => {
      const alert = this.alertService.alert();
      if (!alert) {
        return;
      }

      this.closing.set(false);
      this.message.set(alert.message);
      this.type.set(alert.type);
      this.visible.set(true);

      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      if (this.closeTimeoutId) {
        clearTimeout(this.closeTimeoutId);
      }

      this.timeoutId = setTimeout(() => {
        this.close();
      }, 5000);
    });
  }

  ngOnDestroy(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.closeTimeoutId) clearTimeout(this.closeTimeoutId);
  }

  close(): void {
    if (!this.visible() || this.closing()) return;

    this.closing.set(true);
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.closeTimeoutId = setTimeout(() => {
      this.visible.set(false);
      this.closing.set(false);
    }, 400); // Wait for the fade-out CSS animation
  }
}
