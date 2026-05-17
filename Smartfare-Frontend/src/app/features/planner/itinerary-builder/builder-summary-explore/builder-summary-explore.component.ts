import { ChangeDetectionStrategy, Component, EventEmitter, Output, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Itinerary, ItineraryWorkspace } from '../../../../core/models/itinerary.model';
import { ItineraryService } from '../../../../core/services/itinerary.service';

@Component({
  selector: 'app-builder-summary-explore',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './builder-summary-explore.component.html',
  styleUrls: ['./builder-summary-explore.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BuilderSummaryExploreComponent {
  workspace = input<ItineraryWorkspace | null>(null);

  @Output() previewRequested = new EventEmitter<Itinerary>();

  private itineraryService = inject(ItineraryService);

  publicItineraries = signal<Itinerary[]>([]);

  constructor() {
    effect(() => {
      const ws = this.workspace();
      if (ws?.location?.id) {
        this.itineraryService.getPublicItineraries({ locationId: ws.location.id }).subscribe(list => {
          this.publicItineraries.set(list);
        });
      }
    });
  }

  onPreviewClick(itin: Itinerary) {
    this.previewRequested.emit(itin);
  }
}
