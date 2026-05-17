import { AfterViewInit, Component, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { animate, query, stagger, state, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-cta-section',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cta-section.component.html',
  styleUrl: './cta-section.component.css',
  animations: [
    trigger('ctaReveal', [
      state('hidden', style({ opacity: 0 })),
      state('visible', style({ opacity: 1 })),
      transition('hidden => visible', [
        query('.cta-reveal', [
          style({ opacity: 0, transform: 'translateY(24px)' }),
          stagger(120, animate('700ms cubic-bezier(0.2, 0, 0, 1)', style({ opacity: 1, transform: 'none' })))
        ], { optional: true })
      ])
    ])
  ]
})
export class CtaSectionComponent implements AfterViewInit {
  @ViewChild('ctaRoot', { static: true })
  private readonly ctaRoot?: ElementRef<HTMLElement>;

  protected readonly isVisible = signal(false);

  ngAfterViewInit(): void {
    queueMicrotask(() => this.isVisible.set(true));
  }
}
