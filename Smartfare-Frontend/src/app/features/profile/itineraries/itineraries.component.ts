import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ItineraryService } from '../../../core/services/itinerary.service';
import { Itinerary } from '../../../core/models/itinerary.model';
import { NavbarComponent } from '../../ui/navbar/navbar.component';

type FilterType = 'all' | 'upcoming' | 'past' | 'drafts';

@Component({
  selector: 'app-itineraries',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  templateUrl: './itineraries.component.html',
  styleUrl: './itineraries.component.css',
})
export class ItinerariesComponent implements OnInit {
  private allItineraries = signal<Itinerary[]>([]);
  activeFilter = signal<FilterType>('all');

  filteredItineraries = computed(() => {
    const itineraries = this.allItineraries();
    const filter = this.activeFilter();
    const now = new Date();

    switch (filter) {
      case 'upcoming':
        return itineraries.filter(it => it.isPublished && it.startDate && new Date(it.startDate) > now);
      case 'past':
        return itineraries.filter(it => it.isPublished && it.endDate && new Date(it.endDate) < now);
      case 'drafts':
        return itineraries.filter(it => !it.isPublished);
      default:
        return itineraries;
    }
  });

  constructor(
    private itineraryService: ItineraryService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadItineraries();
  }

  loadItineraries(): void {
    this.itineraryService.getMyItineraries().subscribe(data => {
      this.allItineraries.set(data);
    });
  }

  setFilter(filter: FilterType): void {
    this.activeFilter.set(filter);
  }

  createNewTrip(): void {
    this.router.navigate(['/manual/planner']);
  }

  editItinerary(itinerary: Itinerary): void {
    this.itineraryService.setCurrentItinerary(itinerary, { autosave: false });
    this.router.navigate(['/itineraries/builder'], { queryParams: { itineraryId: itinerary.id } });
  }

  previewItinerary(itinerary: Itinerary): void {
    this.router.navigate(['/itineraries/preview'], { queryParams: { itineraryId: itinerary.id } });
  }

  formatDateRange(itinerary: Itinerary): string {
    if (!itinerary.startDate) return 'Date non confermate';

    const start = new Date(itinerary.startDate);
    const end = itinerary.endDate ? new Date(itinerary.endDate) : null;

    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
    const startStr = start.toLocaleDateString('it-IT', options);

    if (!end) return startStr;

    const endStr = end.toLocaleDateString('it-IT', options);
    return `${startStr} - ${endStr}`;
  }

  getStatusTag(itinerary: Itinerary): string {
    if (!itinerary.isPublished) return 'BOZZA';
    const now = new Date();
    if (itinerary.startDate && new Date(itinerary.startDate) > now) return 'IN ARRIVO';
    if (itinerary.endDate && new Date(itinerary.endDate) < now) return 'PASSATO';
    return '';
  }
}
