import { ChangeDetectionStrategy, Component, Input, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ItineraryService } from '../../../../core/services/itinerary.service';
import { AlertService } from '../../../../core/services/alert.service';
import { ItineraryWorkspace } from '../../../../core/models/itinerary.model';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-builder-summary-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './builder-summary-header.component.html',
  styleUrls: ['./builder-summary-header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BuilderSummaryHeaderComponent {
  workspace = input<ItineraryWorkspace | null>(null);
  @Input() readOnly = false;

  private itineraryService = inject(ItineraryService);
  private alertService = inject(AlertService);
  private http = inject(HttpClient);

  itinerary = this.itineraryService.itinerary;

  isEditingTitle = signal<boolean>(false);
  editTitleValue = signal<string>('');

  isEditingDescription = signal<boolean>(false);
  editDescriptionValue = signal<string>('');

  isUploadingImage = signal<boolean>(false);
  isReadOnly = computed(() => this.readOnly);


  isPublic = computed(() => {
    const itin = this.itinerary();
    return itin?.visibilityCode === 'PUBLIC' || itin?.isPublished === true;
  });

  itineraryDateSummary = computed(() => {
    const itin = this.itinerary();
    if (!itin?.startDate || !itin?.endDate) {
      const days = this.getDaysCount();
      return `${days} ${days === 1 ? 'giorno' : 'giorni'}`;
    }

    const start = new Date(itin.startDate);
    const end = new Date(itin.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const days = this.getDaysCount();
      return `${days} ${days === 1 ? 'giorno' : 'giorni'}`;
    }

    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const startStr = start.toLocaleDateString('it-IT', options);
    const endStr = end.toLocaleDateString('it-IT', options);

    return `${startStr} - ${endStr}`;
  });

  private getDaysCount(): number {
    const itin = this.itinerary();
    if (!itin?.startDate || !itin?.endDate) return 1;

    const start = new Date(itin.startDate);
    const end = new Date(itin.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  async onCoverImageSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.alertService.error('L\'immagine è troppo grande. Massimo 5MB.');
      return;
    }

    const current = this.itinerary();
    const formData = new FormData();
    formData.append('image', file);

    if (current?.id) {
      formData.append('itineraryId', current.id.toString());
    }

    this.isUploadingImage.set(true);

    try {
      const response: any = await this.http.post(`${environment.apiUrl}/api/upload/image`, formData).toPromise();

      if (response && response.url) {
        if (current) {
          this.itineraryService.setCurrentItinerary({
            ...current,
            imageUrl: response.url
          });
          this.alertService.success('Copertina aggiornata con successo!');
        }
      }
    } catch (error) {
      console.error('Errore durante l\'upload:', error);
      this.alertService.error('Errore durante il caricamento dell\'immagine.');
    } finally {
      this.isUploadingImage.set(false);
      event.target.value = '';
    }
  }

  startEditingTitle(): void {
    const currentName = this.itinerary()?.name || this.workspace()?.location?.name || 'Viaggio';
    this.editTitleValue.set(currentName);
    this.isEditingTitle.set(true);
  }

  saveTitle(): void {
    const newName = this.editTitleValue().trim();
    if (newName) {
      const current = this.itinerary();
      if (current) {
        this.itineraryService.setCurrentItinerary({
          ...current,
          name: newName
        });
      }
    }
    this.isEditingTitle.set(false);
  }

  startEditingDescription(): void {
    const currentDesc = this.itinerary()?.description || '';
    this.editDescriptionValue.set(currentDesc);
    this.isEditingDescription.set(true);
  }

  saveDescription(): void {
    const newDesc = this.editDescriptionValue().trim();
    const current = this.itinerary();
    if (current) {
      this.itineraryService.setCurrentItinerary({
        ...current,
        description: newDesc || undefined
      });
    }
    this.isEditingDescription.set(false);
  }

  togglePublish(): void {
    const current = this.itinerary();
    if (!current) return;

    const isCurrentlyPublic = current.visibilityCode === 'PUBLIC' || current.isPublished;
    const newState = !isCurrentlyPublic;

    this.itineraryService.setCurrentItinerary({
      ...current,
      isPublished: newState,
      visibilityCode: newState ? 'PUBLIC' : 'PRIVATE'
    });

    this.alertService.success(newState ? 'Itinerario pubblicato!' : 'Itinerario reso privato.');
  }
}
