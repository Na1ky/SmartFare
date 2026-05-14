import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Itinerary } from '../../../core/models/itinerary.model';
import { RevealOnScrollDirective } from '../../../core/directives/reveal-on-scroll.directive';

@Component({
  selector: 'app-featured-itineraries',
  standalone: true,
  imports: [CommonModule, RouterLink, RevealOnScrollDirective],
  templateUrl: './featured-itineraries.component.html',
  styleUrl: './featured-itineraries.component.css'
})
export class FeaturedItinerariesComponent {
  @Input({ required: true }) itineraries: Itinerary[] = [];
  @Input() loading = false;

  getDuration(itinerary: Itinerary): string {
    const days = itinerary.durationDays;
    if (days != null && days > 0) {
      return `${days} ${days === 1 ? 'Giorno' : 'Giorni'} di Viaggio`;
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
}
