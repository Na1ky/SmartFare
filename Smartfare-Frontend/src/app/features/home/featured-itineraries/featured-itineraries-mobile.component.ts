import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Itinerary } from '../../../core/models/itinerary.model';

@Component({
  selector: 'app-featured-itineraries-mobile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './featured-itineraries-mobile.component.html',
  styleUrl: './featured-itineraries-mobile.component.css'
})
export class FeaturedItinerariesMobileComponent {
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

  getCreatorInitials(itinerary: Itinerary): string {
    const p = itinerary.user?.profile;
    const first = p?.name?.[0] ?? '';
    const last = p?.surname?.[0] ?? '';
    return (first + last).toUpperCase() || 'SF';
  }

  trackById(_index: number, item: Itinerary) {
    return item.id;
  }
}
