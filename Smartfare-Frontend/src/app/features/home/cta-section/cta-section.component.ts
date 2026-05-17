import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
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
        query(
          '.cta-reveal',
          [
            style({ opacity: 0, transform: 'translateY(24px)' }),
            stagger(
              120,
              animate('700ms cubic-bezier(0.2, 0, 0, 1)', style({ opacity: 1, transform: 'none' }))
            ),
          ],
          { optional: true }
        ),
      ]),
    ]),
  ],
})
export class CtaSectionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('ctaRoot', { static: true })
  private readonly ctaRoot?: ElementRef<HTMLElement>;

  protected readonly isVisible = signal(false);
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    if (!this.ctaRoot?.nativeElement) {
      return;
    }

    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          this.isVisible.set(true);
          this.observer?.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    this.observer.observe(this.ctaRoot.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
