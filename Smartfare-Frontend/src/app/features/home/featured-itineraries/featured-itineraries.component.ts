import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Itinerary } from '../../../core/models/itinerary.model';

@Component({
  selector: 'app-featured-itineraries',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './featured-itineraries.component.html',
  styleUrl: './featured-itineraries.component.css',
})
export class FeaturedItinerariesComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) itineraries: Itinerary[] = [];
  @Input() loading = false;

  @ViewChild('sectionEl', { static: true })
  private readonly sectionEl?: ElementRef<HTMLElement>;

  @ViewChildren('revealItem')
  private readonly revealItems!: QueryList<ElementRef<HTMLElement>>;

  private observer?: IntersectionObserver;
  private revealItemsSubscription?: Subscription;

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.14,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    this.observeRevealItems();
    this.revealItemsSubscription = this.revealItems.changes.subscribe(() => {
      this.observeRevealItems();
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.revealItemsSubscription?.unsubscribe();
  }

  getDuration(itinerary: Itinerary): string {
    const days = itinerary.durationDays;
    if (days != null && days > 0) {
      return `${days} ${days === 1 ? 'Giorno' : 'Giorni'}`;
    }
    return 'Durata non definita';
  }

  getItemCount(itinerary: Itinerary): number {
    return itinerary._count?.items ?? itinerary.items?.length ?? 0;
  }

  getCreatorName(itinerary: Itinerary): string {
    const p = itinerary.user?.profile;
    if (p?.name || p?.surname) {
      return `${p.name ?? ''} ${p.surname ?? ''}`.trim();
    }
    return 'Utente SmartFare';
  }

  getCreatorInitials(itinerary: Itinerary): string {
    const p = itinerary.user?.profile;
    const first = p?.name?.[0] ?? '';
    const last = p?.surname?.[0] ?? '';
    return (first + last).toUpperCase() || 'SF';
  }

  private observeRevealItems(): void {
    this.revealItems.forEach((itemRef) => {
      const element = itemRef.nativeElement;
      if (element.dataset['observed'] === 'true') {
        return;
      }

      element.dataset['observed'] = 'true';
      this.observer?.observe(element);
    });
  }
}
