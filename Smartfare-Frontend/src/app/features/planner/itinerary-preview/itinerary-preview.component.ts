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
import { Subject } from 'rxjs';
import { takeUntil, firstValueFrom } from 'rxjs';
import { ItineraryService } from '../../../core/services/itinerary.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { Itinerary } from '../../../core/models/itinerary.model';
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
  private readonly itineraryService = inject(ItineraryService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly destroy$ = new Subject<void>();

  readonly itinerary = signal<Itinerary | null>(null);
  readonly isLoading = signal(true);
  readonly isFavorite = signal(false);
  readonly isSaving = signal(false);
  private readonly currentUserData = signal<any>(null);

  readonly isOwner = computed(() => {
    const itin = this.itinerary();
    const user = this.currentUserData();
    return itin && user && itin.userId === user.id;
  });

  readonly canEdit = computed(() => this.isOwner());

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
          } else {
            this.alertService.error('Itinerario non trovato');
            this.router.navigate(['/home']);
          }
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Errore caricamento itinerario:', error);
          this.alertService.error('Non riesco a caricare l\'itinerario');
          this.isLoading.set(false);
          this.router.navigate(['/home']);
        }
      });
  }

  private checkIfFavorite(itineraryId: number) {
    const user = this.currentUserData();
    if (!user) return;

    this.itineraryService
      .isItineraryFavorite(itineraryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isFav) => this.isFavorite.set(isFav),
        error: (error) => {
          console.error('Errore verifica preferiti:', error);
        }
      });
  }

  async toggleFavorite() {
    const itin = this.itinerary();
    if (!itin?.id) return;

    this.isSaving.set(true);

    try {
      if (this.isFavorite()) {
        await firstValueFrom(this.itineraryService.removeFromFavorites(itin.id));
        this.isFavorite.set(false);
        this.alertService.success('Rimosso dai preferiti');
      } else {
        await firstValueFrom(this.itineraryService.addToFavorites(itin.id));
        this.isFavorite.set(true);
        this.alertService.success('Aggiunto ai preferiti');
      }
    } catch (error) {
      console.error('Errore modifica preferiti:', error);
      this.alertService.error('Errore durante la modifica dei preferiti');
    } finally {
      this.isSaving.set(false);
    }
  }

  async saveAndEdit() {
    const itin = this.itinerary();
    if (!itin || !this.isOwner()) return;

    this.isSaving.set(true);

    try {
      if (!itin.id) {
        await firstValueFrom(this.itineraryService.saveItinerary(itin));
      }

      this.itineraryService.setCurrentItinerary(itin, { autosave: false });
      await this.router.navigate(['/itineraries/builder'], { queryParams: { itineraryId: itin.id } });
    } catch (error) {
      console.error('Errore salvataggio/modifica:', error);
      this.alertService.error('Errore durante il salvataggio');
    } finally {
      this.isSaving.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}

