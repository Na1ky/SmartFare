import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-features-grid',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './features-grid.component.html',
  styleUrl: './features-grid.component.css',
})
export class FeaturesGridComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sectionRoot', { static: true })
  private readonly sectionRoot?: ElementRef<HTMLElement>;

  protected readonly isVisible = signal(false);

  private sectionObserver?: IntersectionObserver;
  private blockObserver?: IntersectionObserver;

  ngAfterViewInit(): void {
    // Reveal the whole section once it enters viewport
    this.sectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          this.isVisible.set(true);
          this.sectionObserver?.disconnect();
        }
      },
      { threshold: 0.05 }
    );

    if (this.sectionRoot?.nativeElement) {
      this.sectionObserver.observe(this.sectionRoot.nativeElement);
    }

    // Individual block reveal on scroll
    this.blockObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            this.blockObserver?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    const blocks =
      this.sectionRoot?.nativeElement?.querySelectorAll('.reveal') ?? [];
    blocks.forEach((el) => this.blockObserver?.observe(el));
  }

  ngOnDestroy(): void {
    this.sectionObserver?.disconnect();
    this.blockObserver?.disconnect();
  }
}
