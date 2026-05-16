// Forced rebuild
import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject, input, signal, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, CdkDragEnd, CdkDragMove, CdkDragStart, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Itinerary, ItineraryWorkspace } from '../../../../core/models/itinerary.model';
import { BuilderPoi } from '../../../../core/models/builder.types';
import { ItineraryService } from '../../../../core/services/itinerary.service';
import { UIStateService } from '../../../../core/services/ui-state.service';
import { AlertService } from '../../../../core/services/alert.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { BuilderSummaryHeaderComponent } from '../builder-summary-header/builder-summary-header.component';
import { BuilderSummaryExploreComponent } from '../builder-summary-explore/builder-summary-explore.component';
import { BuilderSummaryPoiCardComponent } from '../builder-summary-poi-card/builder-summary-poi-card.component';

interface DaySection {
  day: number;
  label: string;
  date: Date | null;
  carouselImages: string[];
  items: BuilderPoi[];
}

interface ExploreCard {
  title: string;
  subtitle: string;
  provider: string;
  imageUrl: string;
}

@Component({
  selector: 'app-builder-summary',
  standalone: true,
  imports: [
    CommonModule, DragDropModule, FormsModule,
    BuilderSummaryHeaderComponent,
    BuilderSummaryExploreComponent,
    BuilderSummaryPoiCardComponent
  ],
  templateUrl: './builder-summary.component.html',
  styleUrls: ['./builder-summary.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BuilderSummaryComponent {
  workspace = input<ItineraryWorkspace | null>(null);
  previewItineraryInput = input<Itinerary | null>(null);
  isPreviewInput = input<boolean>(false);

  @Output() showOnMap = new EventEmitter<BuilderPoi>();

  private itineraryService = inject(ItineraryService);
  private ui = inject(UIStateService);
  private alertService = inject(AlertService);
  private http = inject(HttpClient);

  itinerary = this.itineraryService.itinerary;

  // Modalità Anteprima
  previewItinerary = signal<Itinerary | null>(null);
  isPreviewMode = computed(() => !!this.previewItinerary() || this.isPreviewInput());
  isReadOnlyPreview = computed(() => this.isPreviewMode());
  showPreviewBanner = computed(() => !!this.previewItinerary() && !this.isPreviewInput());

  constructor() {
    // Sincronizza l'input preview all'interno del signal interno solo quando
    // la preview è aperta dall'esplora (non dalla pagina di anteprima dedicata).
    effect(() => {
      const input = this.previewItineraryInput();
      if (!this.isPreviewInput() && input) {
        this.previewItinerary.set(input);
      }
    });
  }

  // ---- Sezione percorso giorno selezionato ----
  /** Giorno attualmente visibile nella mappa (number | 'all') */
  visibleDayRoute = computed(() => this.ui.visibleDayRoute());

  /** URL Google Maps per il giorno selezionato (null se 'all' o < 2 tappe) */
  dayGoogleMapsUrl = computed<string | null>(() => {
    const day = this.ui.visibleDayRoute();
    if (day === 'all') return null;
    const section = this.daySections().find(s => s.day === day);
    if (!section) return null;
    const pois = section.items.filter(
      p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
    );
    if (pois.length < 2) return null;
    return this.buildDayGoogleMapsUrl(pois);
  });

  /** Numero di tappe nel giorno selezionato */
  selectedDayStopsCount = computed<number>(() => {
    const day = this.ui.visibleDayRoute();
    if (day === 'all') return 0;
    const section = this.daySections().find(s => s.day === day);
    return section?.items.length ?? 0;
  });

  // Drag and Drop State
  draggingPoiKey = signal<string | null>(null);
  dragTargetPoiKey = signal<string | null>(null);

  // Stato per i Gruppi (Nome e Orario)
  editingGroupNameKey = signal<string | null>(null);
  editGroupNameValue = signal<string>('');
  activeGroupTimePopup = signal<string | null>(null);
  groupStartTime = signal<string>('');
  groupEndTime = signal<string>('');

  // Note: time popup state and cover upload handled by subcomponents

  // Segnale unito: Itinerario (o Anteprima) + Dati del Workspace (POI)
  joinedPois = computed(() => {
    const itin = this.previewItinerary() || this.previewItineraryInput() || this.itinerary();
    const ws = this.workspace();
    if (!itin || !ws) return [];

    // Crea un indice di tutti i POI disponibili nel workspace per un accesso rapido
    const poiIndex = new Map<string, any>();
    ws.accommodations.forEach(a => poiIndex.set(`accommodation-${a.id}`, { ...a, type: 'accommodation', itemTypeCode: 'ACCOMMODATION' }));
    ws.activities.forEach(a => poiIndex.set(`activity-${a.id}`, { ...a, type: 'activity', itemTypeCode: 'ACTIVITY' }));

    return (itin.items || []).map(item => {
      const key = item.accommodationId ? `accommodation-${item.accommodationId}` : `activity-${item.activityId}`;
      const basePoi = poiIndex.get(key);

      if (!basePoi) return null;

      // Unisce i dati statici del POI con i dati dinamici dell'itinerario (note, orari, ecc.)
      return {
        key,
        type: basePoi.type,
        entityId: basePoi.id,
        title: basePoi.name || basePoi.title || 'Senza nome',
        subtitle: basePoi.street || (basePoi.type === 'accommodation' ? 'Hotel' : basePoi.category?.name || 'Attività'),
        imageUrl: basePoi.imageUrl || '/assets/home-section.avif',
        price: basePoi.price || basePoi.pricePerNight,
        rating: basePoi.stars || basePoi.rating,
        categoryName: basePoi.category?.name,
        // Dati itinerario
        dayNumber: item.dayNumber || 1,
        note: item.note,
        plannedStartAt: item.plannedStartAt,
        plannedEndAt: item.plannedEndAt,
        groupName: item.groupName,
        groupStartAt: item.groupStartAt,
        groupEndAt: item.groupEndAt,
        orderInt: item.orderInt || 0
      } as BuilderPoi;
    }).filter((p): p is BuilderPoi => p !== null);
  });

  // Calcolo automatico della data/durata
  dayOptions = computed(() => {
    const count = this.getDaysCount();
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  // Opzioni orari (es. 08:00, 08:30...)
  timeOptions = computed(() => {
    const options = [];
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 60; j += 30) {
        const h = i.toString().padStart(2, '0');
        const m = j.toString().padStart(2, '0');
        options.push(`${h}:${m}`);
      }
    }
    return options;
  });

  applyItinerary(publicItin: Itinerary): void {
    const target = this.previewItinerary() || publicItin;
    if (!confirm(`Vuoi davvero sovrascrivere il tuo itinerario corrente con "${target.name}"?`)) return;

    // Se siamo già in anteprima, abbiamo già i dati completi
    if (this.isPreviewMode() && this.previewItinerary()?.id === publicItin.id) {
      this.finalizeApply(this.previewItinerary()!);
    } else {
      this.itineraryService.getPublicItineraryById(publicItin.id!).subscribe(fullItin => {
        if (!fullItin) {
          this.alertService.error("Impossibile recuperare i dettagli dell'itinerario selezionato.");
          return;
        }
        this.finalizeApply(fullItin);
      });
    }
  }

  private finalizeApply(fullItin: Itinerary): void {
    const current = this.itinerary();
    if (!current) return;

    const newItems = (fullItin.items || []).map(item => ({
      ...item,
      id: undefined,
      itineraryId: current.id
    }));

    this.itineraryService.setCurrentItinerary(
      this.withNormalizedEndDate(current, newItems)
    );

    this.closePreview();
    this.alertService.success(`Itinerario "${fullItin.name}" applicato con successo!`);
  }

  openPreview(publicItin: Itinerary): void {
    this.itineraryService.getPublicItineraryById(publicItin.id!).subscribe(fullItin => {
      if (fullItin) {
        this.previewItinerary.set(fullItin);
        // Scroll to timeline
        document.querySelector('.wl-timeline-container')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  closePreview(): void {
    this.previewItinerary.set(null);
  }

  // togglePublish extracted

  onPopupClick(event: Event) {
    event.stopPropagation();
  }

  readonly daySections = computed<DaySection[]>(() => {
    const totalDays = Math.max(1, this.getDaysCount());
    const grouped = new Map<number, BuilderPoi[]>();

    for (let day = 1; day <= totalDays; day++) {
      grouped.set(day, []);
    }

    // Determiniamo quali giorni hanno tappe
    const daysWithItems = new Set<number>();
    const pois = this.joinedPois();
    for (const poi of pois) {
      if (poi.dayNumber) daysWithItems.add(poi.dayNumber);
    }

    // Mostriamo i giorni con tappe + sempre il Giorno 1
    const visibleDays = Array.from(daysWithItems);
    if (!visibleDays.includes(1)) visibleDays.push(1);
    visibleDays.sort((a, b) => a - b);

    for (const day of visibleDays) {
      grouped.set(day, []);
    }

    for (const poi of pois) {
      const day = poi.dayNumber || 1;
      if (grouped.has(day)) {
        grouped.get(day)?.push(poi);
      }
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, items]) => {
        const sortedItems = items.slice().sort((a, b) => {
          if (a.orderInt !== b.orderInt) return (a.orderInt || 0) - (b.orderInt || 0);
          return (a.plannedStartAt || '').localeCompare(b.plannedStartAt || '');
        });

        // Genera carosello immagini per il giorno
        const carouselImages = sortedItems
          .map(item => item.imageUrl)
          .filter((url): url is string => !!url);

        if (carouselImages.length === 0) {
          carouselImages.push('/assets/home-section.avif');
        }

        return {
          day,
          label: `Giorno ${day}`,
          date: this.getDayDate(day),
          items: sortedItems,
          carouselImages: carouselImages.slice(0, 5)
        };
      });
  });

  getDaysCount(customItin?: Itinerary | null): number {
    const itinerary = customItin !== undefined ? customItin : (this.previewItinerary() || this.previewItineraryInput() || this.itinerary());
    if (!itinerary?.startDate || !itinerary?.endDate) return 1;

    const start = new Date(itinerary.startDate);
    const end = new Date(itinerary.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  getDayDate(day: number, customItin?: Itinerary | null): Date | null {
    const itinerary = customItin !== undefined ? customItin : (this.previewItinerary() || this.previewItineraryInput() || this.itinerary());
    if (!itinerary?.startDate) return null;

    const date = new Date(itinerary.startDate);
    if (Number.isNaN(date.getTime())) return null;

    date.setDate(date.getDate() + Math.max(0, day - 1));
    return date;
  }

  updatePoi(poi: BuilderPoi, updates: Partial<BuilderPoi>) {
    const current = this.itinerary();
    if (!current?.items) return;

    const updatedItems = current.items.map((item) => {
      const key = item.accommodationId ? `accommodation-${item.accommodationId}` : `activity-${item.activityId}`;
      if (key === poi.key) {
        return { ...item, ...updates };
      }
      return item;
    });

    this.itineraryService.setCurrentItinerary({
      ...current,
      items: updatedItems
    });
  }

  // --- Group Helpers ---
  isFirstInGroup(index: number, items: BuilderPoi[]): boolean {
    const current = items[index];
    if (!current.groupName) return false;
    if (index === 0) return true;
    const prev = items[index - 1];
    return prev.groupName !== current.groupName;
  }

  isLastInGroup(index: number, items: BuilderPoi[]): boolean {
    const current = items[index];
    if (!current.groupName) return false;
    if (index === items.length - 1) return true;
    const next = items[index + 1];
    return next.groupName !== current.groupName;
  }

  startEditingGroupName(groupName: string, event: Event) {
    event.stopPropagation();
    this.editingGroupNameKey.set(groupName);
    this.editGroupNameValue.set(groupName);
  }

  saveGroupName(oldName: string) {
    const newName = this.editGroupNameValue().trim();
    if (newName && newName !== oldName) {
      const current = this.itinerary();
      if (current?.items) {
        const updatedItems = current.items.map(item => {
          if (item.groupName === oldName) {
            return { ...item, groupName: newName };
          }
          return item;
        });
        this.itineraryService.setCurrentItinerary({ ...current, items: updatedItems });
      }
    }
    this.editingGroupNameKey.set(null);
  }

  cancelGroupNameEdit() {
    this.editingGroupNameKey.set(null);
  }

  removeFromGroup(poi: BuilderPoi) {
    const current = this.itinerary();
    if (!current?.items) return;

    const updatedItems = current.items.map((item) => {
      const key = item.accommodationId ? `accommodation-${item.accommodationId}` : `activity-${item.activityId}`;
      if (key === poi.key) {
        return { ...item, groupName: null, groupStartAt: null, groupEndAt: null };
      }
      return item;
    });

    this.itineraryService.setCurrentItinerary({ ...current, items: updatedItems });
  }

  // --- Group Time Popup ---
  openGroupTimePopup(poi: BuilderPoi, event: Event) {
    event.stopPropagation();
    if (!poi.groupName) return;

    let start = '';
    let end = '';
    if (poi.groupStartAt) {
      const d = new Date(poi.groupStartAt);
      if (!Number.isNaN(d.getTime())) {
        start = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }
    }
    if (poi.groupEndAt) {
      const d = new Date(poi.groupEndAt);
      if (!Number.isNaN(d.getTime())) {
        end = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }
    }

    this.groupStartTime.set(start);
    this.groupEndTime.set(end);
    this.activeGroupTimePopup.set(poi.groupName);
  }

  closeGroupTimePopup() {
    this.activeGroupTimePopup.set(null);
  }

  saveGroupTime(groupName: string, dayDate: Date | null) {
    const startStr = this.groupStartTime();
    const endStr = this.groupEndTime();

    let startIso = null;
    let endIso = null;
    const baseDate = dayDate || new Date();

    if (startStr) {
      const [h, m] = startStr.split(':').map(Number);
      const d = new Date(baseDate);
      d.setHours(h, m, 0, 0);
      startIso = d.toISOString();
    }

    if (endStr) {
      const [h, m] = endStr.split(':').map(Number);
      const d = new Date(baseDate);
      d.setHours(h, m, 0, 0);
      endIso = d.toISOString();
    }

    const current = this.itinerary();
    if (!current?.items) {
      this.closeGroupTimePopup();
      return;
    }

    const updatedItems = current.items.map((item) => {
      if (item.groupName === groupName) {
        return { ...item, groupStartAt: startIso, groupEndAt: endIso };
      }
      return item;
    });

    this.itineraryService.setCurrentItinerary({ ...current, items: updatedItems });
    this.closeGroupTimePopup();
  }

  dissolveGroup(groupName: string) {
    const current = this.itinerary();
    if (!current?.items) return;

    const updatedItems = current.items.map((item) => {
      if (item.groupName === groupName) {
        return { ...item, groupName: null, groupStartAt: null, groupEndAt: null };
      }
      return item;
    });

    this.itineraryService.setCurrentItinerary({ ...current, items: updatedItems });
    this.alertService.success('Gruppo sciolto. Le attività sono di nuovo indipendenti.');
  }

  clearGroupTime(groupName: string) {
    const current = this.itinerary();
    if (!current?.items) return;

    const updatedItems = current.items.map((item) => {
      if (item.groupName === groupName) {
        return { ...item, groupStartAt: null, groupEndAt: null };
      }
      return item;
    });

    this.itineraryService.setCurrentItinerary({ ...current, items: updatedItems });
    this.closeGroupTimePopup();
  }


  formatTimeDisplay(poi: BuilderPoi): string {
    const isHotel = poi.type === 'accommodation';
    const start = this.formatTimeString(poi.plannedStartAt, isHotel);
    const end = this.formatTimeString(poi.plannedEndAt, isHotel);

    if (isHotel) {
      if (start && end) return `In: ${start} - Out: ${end}`;
      if (start) return `Check-in: ${start}`;
      if (end) return `Check-out: ${end}`;
      return 'Check-in / Out';
    }

    if (start && end) return `${start} - ${end}`;
    if (start) return start;
    if (end) return end;
    return 'Orari';
  }

  public formatTimeString(isoString: string | null | undefined, includeDate = false): string {
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

  getPoiCover(poi: BuilderPoi): string | null {
    return poi.imageUrl || null;
  }

  getPoiPrice(poi: BuilderPoi): string | null {
    if (typeof poi.price !== 'number' || Number.isNaN(poi.price)) return null;
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(poi.price);
  }

  encode(str: string): string {
    return encodeURIComponent(str);
  }

  getDayColor(day: number): string {
    return this.ui.getDefaultDayColor(day);
  }

  removeItem(poi: BuilderPoi): void {
    const current = this.itinerary();
    if (!current?.items) return;

    const updatedItems = current.items.filter((item) => {
      const key = item.accommodationId ? `accommodation-${item.accommodationId}` : `activity-${item.activityId}`;
      return key !== poi.key;
    });

    this.itineraryService.setCurrentItinerary({
      ...current,
      items: updatedItems
    });
  }

  drop(event: CdkDragDrop<BuilderPoi[]>, newDay: number): void {
    // Se c'è un target valido per il gruppo, ignoriamo il riordinamento classico
    if (this.dragTargetPoiKey() || this.skipDrop) {
      return;
    }

    const current = this.itinerary();
    if (!current?.items) return;

    const movedPoi = event.item.data as BuilderPoi | undefined;
    if (!movedPoi) return;

    const dayMap = this.buildDayMap(current.items);
    const sourceDay = movedPoi.dayNumber ?? this.findDayByKey(dayMap, movedPoi.key) ?? newDay;
    const sourceList = [...(dayMap.get(sourceDay) || [])];
    const targetList = event.previousContainer === event.container ? sourceList : [...(dayMap.get(newDay) || [])];

    if (event.previousContainer === event.container) {
      moveItemInArray(sourceList, event.previousIndex, event.currentIndex);
      dayMap.set(sourceDay, sourceList);
    } else {
      transferArrayItem(sourceList, targetList, event.previousIndex, event.currentIndex);
      dayMap.set(sourceDay, sourceList);
      dayMap.set(newDay, targetList);
    }

    this.updateItineraryOrder(dayMap);
  }

  private skipDrop = false;

  onPoiDragStarted(poi: BuilderPoi): void {
    this.draggingPoiKey.set(poi.key);
    this.dragTargetPoiKey.set(null);
    this.skipDrop = false;
  }

  onPoiDragMoved(event: CdkDragMove<BuilderPoi>, sourcePoi: BuilderPoi): void {
    // La logica di rilevamento target per il raggruppamento tramite drag è stata rimossa
    // in favore della selezione multipla tramite checkbox.
  }

  onPoiDragEnded(event: CdkDragEnd<BuilderPoi>, sourcePoi: BuilderPoi, sourceDay: number): void {
    this.draggingPoiKey.set(null);
  }

  // --- Multi-Selection & Grouping ---
  selectedPoiKeys = signal<Set<string>>(new Set<string>());

  toggleSelection(poi: BuilderPoi) {
    const current = new Set(this.selectedPoiKeys());
    if (current.has(poi.key)) {
      current.delete(poi.key);
    } else {
      current.add(poi.key);
    }
    this.selectedPoiKeys.set(current);
  }

  clearSelection() {
    this.selectedPoiKeys.set(new Set<string>());
  }

  createGroupFromSelection() {
    const current = this.itinerary();
    const selectedKeys = Array.from(this.selectedPoiKeys());
    if (!current?.items || selectedKeys.length < 2) return;

    // Trova le attività selezionate
    const allPois = this.joinedPois();
    const selectedPois = allPois.filter(p => selectedKeys.includes(p.key));

    // Usa il giorno della prima attività selezionata come giorno di riferimento
    const targetDay = selectedPois[0]?.dayNumber || 1;
    const groupName = `Gruppo Giorno ${targetDay} - ${Math.floor(Math.random() * 1000)}`;

    const dayMap = this.buildDayMap(current.items);

    // Rimuovi tutti gli elementi selezionati dalle loro posizioni attuali
    for (const key of selectedKeys) {
      for (const [day, list] of dayMap.entries()) {
        const idx = list.indexOf(key);
        if (idx !== -1) {
          list.splice(idx, 1);
        }
      }
    }

    // Aggiungi tutti gli elementi selezionati alla fine del giorno di riferimento
    const targetList = dayMap.get(targetDay) || [];
    targetList.push(...selectedKeys);
    dayMap.set(targetDay, targetList);

    const orderMap = this.buildOrderMap(dayMap);

    const updatedItems = current.items.map((item) => {
      const key = item.accommodationId ? `accommodation-${item.accommodationId}` : `activity-${item.activityId}`;
      const isSelected = selectedKeys.includes(key);
      const position = orderMap.get(key);

      if (isSelected) {
        return {
          ...item,
          dayNumber: position?.day || targetDay,
          orderInt: position?.order || 0,
          groupName: groupName,
          groupStartAt: null,
          groupEndAt: null
        };
      }

      if (position) {
        return { ...item, dayNumber: position.day, orderInt: position.order };
      }

      return item;
    });

    this.itineraryService.setCurrentItinerary({
      ...this.withNormalizedEndDate(current, updatedItems),
      items: updatedItems
    });

    this.clearSelection();
    this.alertService.success('Attività raggruppate con successo!');
  }

  deleteSelected() {
    const current = this.itinerary();
    const selectedKeys = this.selectedPoiKeys();
    if (!current?.items || selectedKeys.size === 0) return;

    const updatedItems = current.items.filter((item) => {
      const key = item.accommodationId ? `accommodation-${item.accommodationId}` : `activity-${item.activityId}`;
      return !selectedKeys.has(key);
    });

    this.itineraryService.setCurrentItinerary({
      ...this.withNormalizedEndDate(current, updatedItems),
      items: updatedItems
    });

    this.clearSelection();
    this.alertService.success(`${selectedKeys.size} attività rimosse.`);
  }

  private buildDayMap(items: Itinerary['items'] = []): Map<number, string[]> {
    const sorted = [...items].sort((a, b) => {
      if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
      return a.orderInt - b.orderInt;
    });
    const map = new Map<number, string[]>();
    sorted.forEach((item) => {
      const day = item.dayNumber || 1;
      const key = item.accommodationId
        ? `accommodation-${item.accommodationId}`
        : `activity-${item.activityId}`;

      if (!map.has(day)) {
        map.set(day, []);
      }
      map.get(day)!.push(key);
    });
    return map;
  }

  private findDayByKey(dayMap: Map<number, string[]>, key: string): number | null {
    for (const [day, keys] of dayMap.entries()) {
      if (keys.includes(key)) {
        return day;
      }
    }
    return null;
  }

  private updateItineraryOrder(dayMap: Map<number, string[]>): void {
    const current = this.itinerary();
    if (!current) return;

    const orderMap = this.buildOrderMap(dayMap);

    const updatedItems = [...(current.items || [])].map((item) => {
      const key = item.accommodationId ? `accommodation-${item.accommodationId}` : `activity-${item.activityId}`;
      const position = orderMap.get(key);

      if (position) {
        return { ...item, dayNumber: position.day, orderInt: position.order };
      }
      return item;
    });

    this.itineraryService.setCurrentItinerary({
      ...this.withNormalizedEndDate(current, updatedItems),
      items: updatedItems
    });
  }

  private buildOrderMap(dayMap: Map<number, string[]>): Map<string, { day: number; order: number }> {
    const orderMap = new Map<string, { day: number; order: number }>();
    Array.from(dayMap.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([day, keys]) => {
        keys.forEach((key, index) => {
          orderMap.set(key, { day, order: index + 1 });
        });
      });
    return orderMap;
  }

  private groupPoisByDrop(movedPoi: BuilderPoi, targetPoi: BuilderPoi, targetDay: number): void {
    const current = this.itinerary();
    if (!current?.items?.length) return;

    const movedKey = movedPoi.key;
    const targetKey = targetPoi.key;

    const dayMap = this.buildDayMap(current.items);
    const sourceDay = this.findDayByKey(dayMap, movedKey) ?? movedPoi.dayNumber ?? targetDay;

    const sourceList = [...(dayMap.get(sourceDay) || [])];
    const targetList = sourceDay === targetDay ? sourceList : [...(dayMap.get(targetDay) || [])];

    const removeAt = sourceList.indexOf(movedKey);
    if (removeAt >= 0) {
      sourceList.splice(removeAt, 1);
    }

    const insertAfter = targetList.indexOf(targetKey);
    const insertIndex = insertAfter >= 0 ? insertAfter + 1 : targetList.length;

    if (!targetList.includes(movedKey)) {
      targetList.splice(insertIndex, 0, movedKey);
    }

    if (sourceDay === targetDay) {
      dayMap.set(targetDay, targetList);
    } else {
      dayMap.set(sourceDay, sourceList);
      dayMap.set(targetDay, targetList);
    }

    const orderMap = this.buildOrderMap(dayMap);
    const existingGroupName = targetPoi.groupName || movedPoi.groupName;
    const groupName = existingGroupName || `Gruppo Giorno ${targetDay}`;
    const groupStartAt = targetPoi.groupStartAt || movedPoi.groupStartAt || null;
    const groupEndAt = targetPoi.groupEndAt || movedPoi.groupEndAt || null;

    const updatedItems = current.items.map((item) => {
      const key = item.accommodationId ? `accommodation-${item.accommodationId}` : `activity-${item.activityId}`;
      const position = orderMap.get(key);
      const shouldGroup = key === movedKey || key === targetKey;

      return {
        ...item,
        ...(position ? { dayNumber: position.day, orderInt: position.order } : {}),
        ...(shouldGroup
          ? {
            groupName,
            groupStartAt,
            groupEndAt
          }
          : {})
      };
    });

    this.itineraryService.setCurrentItinerary({
      ...this.withNormalizedEndDate(current, updatedItems),
      items: updatedItems
    });

    this.alertService.success(`Gruppo "${groupName}" creato. Ora puoi modificarne nome e orari.`);
  }

  private getPointerPoint(event: MouseEvent | TouchEvent | undefined): { x: number; y: number } | null {
    if (!event) return null;

    if ('clientX' in event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      return { x: event.clientX, y: event.clientY };
    }

    if ('changedTouches' in event && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }

    return null;
  }

  private withNormalizedEndDate(itin: Itinerary, items: Itinerary['items']): Itinerary {
    const safeItems = items || [];
    const maxDay = safeItems.reduce((max, item) => Math.max(max, item.dayNumber || 1), 1);
    if (!itin.startDate) {
      return {
        ...itin,
        items: safeItems
      };
    }

    const start = new Date(itin.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + maxDay - 1);

    return {
      ...itin,
      items: safeItems,
      endDate: end.toISOString().split('T')[0]
    };
  }

  addDay(): void {
    const current = this.itinerary();
    if (!current) return;

    if (!current.startDate) {
      this.alertService.warning('Imposta prima una data di inizio per aggiungere altri giorni.');
      return;
    }

    const maxDay = this.getDaysCount();
    const startDate = new Date(current.startDate);
    const newEndDate = new Date(startDate);
    newEndDate.setDate(startDate.getDate() + maxDay);

    this.itineraryService.setCurrentItinerary({
      ...current,
      endDate: newEndDate.toISOString().split('T')[0]
    });

    this.alertService.success(`Giorno ${maxDay + 1} aggiunto.`);
  }

  removeDay(): void {
    const current = this.itinerary();
    if (!current || !current.endDate) return;

    const maxDay = this.getDaysCount();
    if (maxDay <= 1) {
      this.alertService.warning('Non puoi rimuovere l\'unico giorno rimasto.');
      return;
    }

    const endDate = new Date(current.endDate);
    endDate.setDate(endDate.getDate() - 1);

    this.itineraryService.setCurrentItinerary({
      ...current,
      endDate: endDate.toISOString().split('T')[0]
    });

    this.alertService.success(`Giorno ${maxDay} rimosso.`);
  }

  private buildDayGoogleMapsUrl(pois: BuilderPoi[]): string | null {
    if (pois.length < 2) return null;
    const maxWaypoints = 8;
    const origin = `${pois[0].latitude},${pois[0].longitude}`;
    const destination = `${pois[pois.length - 1].latitude},${pois[pois.length - 1].longitude}`;
    const waypointPois = pois.slice(1, -1).slice(0, maxWaypoints);
    const waypointParam = waypointPois.map(p => `${p.latitude},${p.longitude}`).join('|');
    const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' });
    if (waypointParam) params.set('waypoints', waypointParam);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
}
