import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { BuilderPoi } from '../../../../core/models/builder.types';
import { ItineraryService } from '../../../../core/services/itinerary.service';

@Component({
  selector: 'app-builder-summary-poi-card',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './builder-summary-poi-card.component.html',
  styleUrls: ['./builder-summary-poi-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BuilderSummaryPoiCardComponent {
  @Input({ required: true }) poi!: BuilderPoi;
  @Input({ required: true }) dayNumber!: number;
  @Input({ required: true }) index!: number;
  @Input({ required: true }) isLast!: boolean;
  @Input({ required: true }) dayColor!: string;
  @Input({ required: true }) isSelected = false;
  @Input() totalDaysCount = 1;
  @Input() readOnly = false;

  @Output() toggleSelect = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();
  @Output() poiUpdate = new EventEmitter<Partial<BuilderPoi>>();

  private itineraryService = inject(ItineraryService);

  isEditingNote = signal(false);
  isTimePopupOpen = signal(false);

  popupStartDay = signal<number>(1);
  popupEndDay = signal<number>(1);
  popupStartTime = signal<string>('');
  popupEndTime = signal<string>('');

  timeOptions = this.generateTimeOptions();

  get dayOptions() {
    return Array.from({ length: this.totalDaysCount }, (_, i) => i + 1);
  }

  generateTimeOptions() {
    const options = [];
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 60; j += 30) {
        const h = i.toString().padStart(2, '0');
        const m = j.toString().padStart(2, '0');
        options.push(`${h}:${m}`);
      }
    }
    return options;
  }

  encode(str: string): string {
    return encodeURIComponent(str);
  }

  onToggleSelection(event: Event) {
    event.stopPropagation();
    if (this.readOnly) return;
    this.toggleSelect.emit();
  }

  onRemove(event: Event) {
    event.stopPropagation();
    if (this.readOnly) return;
    this.remove.emit();
  }

  updateNote(newNote: string) {
    if (this.readOnly) return;
    this.poiUpdate.emit({ note: newNote });
  }

  openTimePopup(event: Event) {
    event.stopPropagation();
    if (this.readOnly) return;

    let start = '';
    let end = '';
    if (this.poi.plannedStartAt) {
      const d = new Date(this.poi.plannedStartAt);
      if (!Number.isNaN(d.getTime())) start = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    if (this.poi.plannedEndAt) {
      const d = new Date(this.poi.plannedEndAt);
      if (!Number.isNaN(d.getTime())) end = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }

    this.popupStartTime.set(start);
    this.popupEndTime.set(end);

    const startD = this.poi.plannedStartAt ? new Date(this.poi.plannedStartAt) : null;
    const endD = this.poi.plannedEndAt ? new Date(this.poi.plannedEndAt) : null;

    this.popupStartDay.set(startD ? this.getDayNumberFromDate(startD) : this.poi.dayNumber || 1);
    this.popupEndDay.set(endD ? this.getDayNumberFromDate(endD) : this.poi.dayNumber || 1);

    this.isTimePopupOpen.set(true);
  }

  private getDayNumberFromDate(date: Date): number {
    const itinerary = this.itineraryService.itinerary();
    if (!itinerary?.startDate) return 1;
    const start = new Date(itinerary.startDate);
    const diff = date.getTime() - start.getTime();
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  private getDayDate(day: number): Date | null {
    const itinerary = this.itineraryService.itinerary();
    if (!itinerary?.startDate) return null;
    const date = new Date(itinerary.startDate);
    if (Number.isNaN(date.getTime())) return null;
    date.setDate(date.getDate() + Math.max(0, day - 1));
    return date;
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.isTimePopupOpen()) {
      this.isTimePopupOpen.set(false);
    }
  }

  onPopupClick(event: Event) {
    event.stopPropagation();
  }

  saveTime() {
    if (this.readOnly) return;
    const startStr = this.popupStartTime();
    const endStr = this.popupEndTime();

    let startIso: string | null = null;
    let endIso: string | null = null;

    const startDayDate = this.getDayDate(this.popupStartDay()) || new Date();
    const endDayDate = this.getDayDate(this.popupEndDay()) || new Date();

    if (startStr && startDayDate) {
      const [h, m] = startStr.split(':').map(Number);
      const d = new Date(startDayDate);
      d.setHours(h, m, 0, 0);
      startIso = d.toISOString();
    }

    if (endStr && endDayDate) {
      const [h, m] = endStr.split(':').map(Number);
      const d = new Date(endDayDate);
      d.setHours(h, m, 0, 0);
      endIso = d.toISOString();
    }

    this.poiUpdate.emit({ plannedStartAt: startIso, plannedEndAt: endIso });
    this.isTimePopupOpen.set(false);
  }

  clearTime() {
    if (this.readOnly) return;
    this.poiUpdate.emit({ plannedStartAt: null as any, plannedEndAt: null as any });
    this.isTimePopupOpen.set(false);
  }

  formatTimeString(isoString: string | null | undefined, includeDate = false): string {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';

    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    if (includeDate) {
      const date = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
      return `${date} ore ${time}`;
    }
    return time;
  }
}
