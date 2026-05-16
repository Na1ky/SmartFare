import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';
import { ItineraryService } from '../../../core/services/itinerary.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { Itinerary, ItineraryWorkspace } from '../../../core/models/itinerary.model';
import Location from '../../../core/models/location.model';
import { BuilderPoi } from '../../../core/models/builder.types';
import { BuilderMapComponent } from '../itinerary-builder/builder-map/builder-map.component';
import { BuilderSummaryComponent } from '../itinerary-builder/builder-summary/builder-summary.component';

@Component({
  selector: 'app-itinerary-preview',
  standalone: true,
  imports: [CommonModule, RouterModule, BuilderMapComponent, BuilderSummaryComponent],
  templateUrl: './itinerary-preview.component.html',
  styleUrl: './itinerary-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItineraryPreviewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly itineraryService = inject(ItineraryService);
  readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly destroy$ = new Subject<void>();

  readonly itinerary = signal<Itinerary | null>(null);
  readonly workspace = signal<ItineraryWorkspace | null>(null);
  readonly isLoading = signal(true);
  readonly isFavorite = signal(false);
  readonly isSaving = signal(false);
  readonly isCopying = signal(false);
  readonly mobileActivePanel = signal<'map' | 'summary'>('summary');

  // Resizable panel
  readonly summaryPanelWidth = signal<number>(0);
  readonly isResizing = signal(false);
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  private readonly currentUserData = signal<any>(null);

  readonly isOwner = computed(() => {
    const itin = this.itinerary();
    const user = this.currentUserData();
    return !!(itin && user && itin.userId === user.userId);
  });

  readonly previewSavedPois = computed<BuilderPoi[]>(() => {
    const itin = this.itinerary();
    const ws = this.workspace();
    if (!itin?.items?.length) return [];

    const poiByKey = new Map<string, any>();
    ws?.accommodations.forEach((acc) => poiByKey.set(`accommodation-${acc.id}`, { ...acc, type: 'accommodation' as const }));
    ws?.activities.forEach((act) => poiByKey.set(`activity-${act.id}`, { ...act, type: 'activity' as const }));

    return itin.items
      .slice()
      .sort((a, b) => {
        if ((a.dayNumber || 1) !== (b.dayNumber || 1)) return (a.dayNumber || 1) - (b.dayNumber || 1);
        return (a.orderInt || 0) - (b.orderInt || 0);
      })
      .map((item) => {
        const key = item.accommodationId ? `accommodation-${item.accommodationId}` : `activity-${item.activityId}`;
        const fallbackFromItem = item.accommodation
          ? { ...item.accommodation, type: 'accommodation' as const }
          : item.activity
            ? { ...item.activity, type: 'activity' as const }
            : null;
        const base = poiByKey.get(key) || fallbackFromItem;
        if (!base) return null;

        return {
          key,
          type: base.type,
          entityId: base.id,
          title: base.name || 'Senza nome',
          subtitle: base.street || (base.type === 'accommodation' ? 'Hotel' : base.category?.name || 'Attivita'),
          latitude: base.latitude,
          longitude: base.longitude,
          categoryId: base.categoryId,
          categoryName: base.category?.name,
          itemTypeCode: base.type === 'accommodation' ? 'ACCOMMODATION' : 'ACTIVITY',
          dayNumber: item.dayNumber || 1,
          note: item.note,
          plannedStartAt: item.plannedStartAt || null,
          plannedEndAt: item.plannedEndAt || null,
          groupName: item.groupName || null,
          groupStartAt: item.groupStartAt || null,
          groupEndAt: item.groupEndAt || null,
          imageUrl: base.imageUrl,
          price: base.price ?? base.pricePerNight,
          rating: base.rating ?? base.stars,
          orderInt: item.orderInt || 0
        } as BuilderPoi;
      })
      .filter((poi): poi is BuilderPoi => !!poi);
  });

  readonly previewLocation = computed<Location | null>(() => {
    const wsLocation = this.workspace()?.location;
    if (wsLocation) return wsLocation;

    const itineraryLocation = this.itinerary()?.location;
    if (itineraryLocation) return itineraryLocation;

    const firstPoi = this.previewSavedPois()[0];
    if (!firstPoi) return null;

    return {
      id: -1,
      name: this.itinerary()?.name || 'Destinazione',
      province: '',
      cap: '',
      latitude: firstPoi.latitude,
      longitude: firstPoi.longitude
    };
  });

  ngOnInit() {
    this.currentUserData.set(this.authService.getUserData());
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const itineraryId = parseInt(params['itineraryId'], 10);
        if (itineraryId) {
          this.loadItinerary(itineraryId);
          this.checkIfFavorite(itineraryId);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadItinerary(itineraryId: number) {
    this.isLoading.set(true);
    this.itineraryService
      .getItineraryById(itineraryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          if (data) {
            this.itinerary.set(data);
            // Carica il workspace per la mappa e il summary
            if (data.locationId) {
              this.loadWorkspace(data.locationId);
            } else {
              this.isLoading.set(false);
            }
          } else {
            this.alertService.error('Itinerario non trovato');
            this.router.navigate(['/home']);
            this.isLoading.set(false);
          }
        },
        error: () => {
          this.alertService.error("Non riesco a caricare l'itinerario");
          this.isLoading.set(false);
          this.router.navigate(['/home']);
        }
      });
  }

  private loadWorkspace(locationId: number) {
    this.itineraryService
      .getWorkspace(locationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ws) => {
          this.workspace.set(ws);
          this.isLoading.set(false);
        },
        error: () => {
          // Workspace non fondamentale — mostriamo comunque
          this.isLoading.set(false);
        }
      });
  }

  private checkIfFavorite(itineraryId: number) {
    if (!this.authService.IsAuthenticated()) return;
    this.itineraryService
      .isItineraryFavorite(itineraryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isFav) => this.isFavorite.set(isFav),
        error: () => { }
      });
  }

  async toggleFavorite() {
    const itin = this.itinerary();
    if (!itin?.id) return;
    if (!this.authService.IsAuthenticated()) {
      this.alertService.warning('Accedi per aggiungere ai preferiti');
      await this.router.navigate(['/login']);
      return;
    }
    this.isSaving.set(true);
    try {
      if (this.isFavorite()) {
        await firstValueFrom(this.itineraryService.removeFromFavorites(itin.id));
        this.isFavorite.set(false);
        this.alertService.success('Rimosso dai preferiti');
      } else {
        await firstValueFrom(this.itineraryService.addToFavorites(itin.id));
        this.isFavorite.set(true);
        this.alertService.success('Aggiunto ai preferiti!');
      }
    } catch {
      this.alertService.error('Errore durante la modifica dei preferiti');
    } finally {
      this.isSaving.set(false);
    }
  }

  async editItinerary() {
    const itin = this.itinerary();
    if (!itin) return;
    this.isSaving.set(true);
    try {
      this.itineraryService.setCurrentItinerary(itin, { autosave: false });
      await this.router.navigate(['/itineraries/builder'], {
        queryParams: { itineraryId: itin.id }
      });
    } catch {
      this.alertService.error('Errore durante la navigazione al builder');
    } finally {
      this.isSaving.set(false);
    }
  }

  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/profile/itineraries']);
    }
  }

  setMobilePanel(panel: 'map' | 'summary') {
    this.mobileActivePanel.set(panel);
  }

  // Resize handlers for the summary panel
  onResizeStart(event: MouseEvent) {
    if (window.matchMedia('(max-width: 1024px)').matches) return; // Disable on mobile/tablet
    event.preventDefault();
    this.isResizing.set(true);
    this.resizeStartX = event.clientX;

    const workspaceEl = document.querySelector('.preview-workspace') as HTMLElement;
    if (workspaceEl) {
      this.resizeStartWidth = workspaceEl.querySelector('.preview-panel--summary')?.clientWidth || 0;
    }

    // Listen to mouse move and mouse up globally
    document.addEventListener('mousemove', this.onResizeMove.bind(this));
    document.addEventListener('mouseup', this.onResizeEnd.bind(this));
  }

  private onResizeMove(event: MouseEvent) {
    if (!this.isResizing()) return;

    const delta = event.clientX - this.resizeStartX;
    const newWidth = Math.max(280, Math.min(600, this.resizeStartWidth + delta)); // Min 280px, Max 600px

    this.summaryPanelWidth.set(newWidth);

    // Apply width to the DOM
    const summaryPanel = document.querySelector('.preview-panel--summary') as HTMLElement;
    if (summaryPanel) {
      summaryPanel.style.width = `${newWidth}px`;
    }
  }

  private onResizeEnd(event: MouseEvent) {
    this.isResizing.set(false);
    document.removeEventListener('mousemove', this.onResizeMove.bind(this));
    document.removeEventListener('mouseup', this.onResizeEnd.bind(this));
  }

  // Copy itinerary to user's collection
  async copyItinerary() {
    const itin = this.itinerary();
    if (!itin) return;

    if (!this.authService.IsAuthenticated()) {
      this.alertService.warning('Devi essere loggato per incorporare un itinerario');
      await this.router.navigate(['/login']);
      return;
    }

    this.isCopying.set(true);
    try {
      const copied = await firstValueFrom(this.itineraryService.copyItinerary(itin));
      if (copied && copied.id) {
        this.alertService.success(`Itinerario "${copied.name}" salvato!`);
        await this.router.navigate(['/itineraries/builder'], {
          queryParams: { itineraryId: copied.id }
        });
      } else {
        this.alertService.error('Errore durante il salvataggio dell\'itinerario');
      }
    } catch (err) {
      this.alertService.error('Errore durante il salvataggio dell\'itinerario');
      console.error('Error copying itinerary:', err);
    } finally {
      this.isCopying.set(false);
    }
  }
}
