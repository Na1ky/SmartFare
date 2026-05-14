import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ItineraryService } from '../../../core/services/itinerary.service';
import { Itinerary } from '../../../core/models/itinerary.model';
import { NavbarComponent } from '../../ui/navbar/navbar.component';

type TabType = 'itineraries' | 'favorites';

@Component({
  selector: 'app-itineraries',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, FormsModule],
  templateUrl: './itineraries.component.html',
  styleUrl: './itineraries.component.css',
})
export class ItinerariesComponent implements OnInit {
  private allItineraries = signal<Itinerary[]>([]);
  private allFavorites = signal<Itinerary[]>([]);

  isLoading = signal(false);
  activeTab = signal<TabType>('itineraries');

  // Sidebar filter state (pending, before Apply)
  filterUpcoming = signal(false);
  filterInProgress = signal(false);
  filterCompleted = signal(false);
  filterDrafts = signal(false);
  filterTimeframe = signal('all');

  // Applied filters (activated on Apply click)
  appliedUpcoming = signal(false);
  appliedInProgress = signal(false);
  appliedCompleted = signal(false);
  appliedDrafts = signal(false);
  appliedTimeframe = signal('all');

  searchQuery = signal('');

  // ─── Computed filtered list ───────────────────────────────────────────────
  filteredItineraries = computed(() => {
    const source =
      this.activeTab() === 'favorites'
        ? this.allFavorites()
        : this.allItineraries();

    const now = new Date();
    const search = this.searchQuery().toLowerCase().trim();

    let result = search
      ? source.filter(
          it =>
            it.name.toLowerCase().includes(search) ||
            it.location?.name?.toLowerCase().includes(search)
        )
      : [...source];

    // Status filters
    const anyStatus =
      this.appliedUpcoming() ||
      this.appliedInProgress() ||
      this.appliedCompleted() ||
      this.appliedDrafts();

    if (anyStatus) {
      result = result.filter(it => {
        if (this.appliedDrafts() && !it.isPublished) return true;
        if (!it.isPublished) return false;
        if (
          this.appliedUpcoming() &&
          it.startDate &&
          new Date(it.startDate) > now
        )
          return true;
        if (
          this.appliedCompleted() &&
          it.endDate &&
          new Date(it.endDate) < now
        )
          return true;
        if (this.appliedInProgress()) {
          const s = it.startDate ? new Date(it.startDate) : null;
          const e = it.endDate ? new Date(it.endDate) : null;
          if (s && e && s <= now && e >= now) return true;
        }
        return false;
      });
    }

    // Timeframe filter
    const tf = this.appliedTimeframe();
    if (tf !== 'all') {
      result = result.filter(it => {
        if (!it.startDate) return false;
        const s = new Date(it.startDate);
        const e = it.endDate ? new Date(it.endDate) : null;
        if (tf === 'next6months') {
          const limit = new Date();
          limit.setMonth(limit.getMonth() + 6);
          return s >= now && s <= limit;
        }
        if (tf === 'nextyear') {
          const limit = new Date();
          limit.setFullYear(limit.getFullYear() + 1);
          return s >= now && s <= limit;
        }
        if (tf === 'past') return e ? e < now : s < now;
        return true;
      });
    }

    return result;
  });

  get totalCount() {
    return this.allItineraries().length;
  }
  get favoritesCount() {
    return this.allFavorites().length;
  }
  get hasActiveFilters(): boolean {
    return (
      this.appliedUpcoming() ||
      this.appliedInProgress() ||
      this.appliedCompleted() ||
      this.appliedDrafts() ||
      this.appliedTimeframe() !== 'all'
    );
  }

  constructor(
    private itineraryService: ItineraryService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'favorites') {
        this.activeTab.set('favorites');
        this.loadFavorites();
      } else {
        this.activeTab.set('itineraries');
        this.loadItineraries();
      }
    });
  }

  loadItineraries(): void {
    this.isLoading.set(true);
    this.itineraryService.getMyItineraries().subscribe(data => {
      this.allItineraries.set(data);
      this.isLoading.set(false);
    });
  }

  loadFavorites(): void {
    this.isLoading.set(true);
    this.itineraryService.getMyFavorites().subscribe(data => {
      this.allFavorites.set(data);
      this.isLoading.set(false);
    });
  }

  setTab(tab: TabType): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      queryParams: { tab: tab === 'favorites' ? 'favorites' : null },
      queryParamsHandling: 'merge',
    });
    if (tab === 'favorites' && this.allFavorites().length === 0) {
      this.loadFavorites();
    } else if (tab === 'itineraries' && this.allItineraries().length === 0) {
      this.loadItineraries();
    }
  }

  applyFilters(): void {
    this.appliedUpcoming.set(this.filterUpcoming());
    this.appliedInProgress.set(this.filterInProgress());
    this.appliedCompleted.set(this.filterCompleted());
    this.appliedDrafts.set(this.filterDrafts());
    this.appliedTimeframe.set(this.filterTimeframe());
  }

  resetFilters(): void {
    this.filterUpcoming.set(false);
    this.filterInProgress.set(false);
    this.filterCompleted.set(false);
    this.filterDrafts.set(false);
    this.filterTimeframe.set('all');
    this.appliedUpcoming.set(false);
    this.appliedInProgress.set(false);
    this.appliedCompleted.set(false);
    this.appliedDrafts.set(false);
    this.appliedTimeframe.set('all');
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  createNewTrip(): void {
    this.router.navigate(['/itineraries/new']);
  }

  editItinerary(itinerary: Itinerary, event: Event): void {
    event.stopPropagation();
    this.itineraryService.setCurrentItinerary(itinerary, { autosave: false });
    this.router.navigate(['/itineraries/builder'], {
      queryParams: { itineraryId: itinerary.id },
    });
  }

  previewItinerary(itinerary: Itinerary, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/itineraries/preview'], {
      queryParams: { itineraryId: itinerary.id },
    });
  }

  formatDateRange(itinerary: Itinerary): string {
    if (!itinerary.startDate) return 'Date da confermare';
    const start = new Date(itinerary.startDate);
    const end = itinerary.endDate ? new Date(itinerary.endDate) : null;
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    const startStr = start.toLocaleDateString('it-IT', opts);
    if (!end) return startStr;
    return `${startStr} – ${end.toLocaleDateString('it-IT', opts)}`;
  }

  getStatusLabel(itinerary: Itinerary): string {
    if (!itinerary.isPublished) return 'Bozza';
    const now = new Date();
    if (itinerary.startDate && new Date(itinerary.startDate) > now) return 'In Programma';
    if (itinerary.endDate && new Date(itinerary.endDate) < now) return 'Completato';
    return 'In Corso';
  }

  getStatusClass(itinerary: Itinerary): string {
    switch (this.getStatusLabel(itinerary)) {
      case 'Bozza': return 'draft';
      case 'In Programma': return 'upcoming';
      case 'Completato': return 'completed';
      case 'In Corso': return 'in-progress';
      default: return '';
    }
  }
}
