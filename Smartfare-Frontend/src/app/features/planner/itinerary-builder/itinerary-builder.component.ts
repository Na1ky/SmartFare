import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { BuilderHeaderComponent } from './builder-header/builder-header.component';
import { BuilderSidebarComponent } from './builder-sidebar/builder-sidebar.component';
import { BuilderMapComponent } from './builder-map/builder-map.component';
import { BuilderSummaryComponent } from './builder-summary/builder-summary.component';
import { BuilderChatComponent } from './builder-chat/builder-chat.component';
import { BuilderPoiEditorComponent } from './builder-poi-editor/builder-poi-editor.component';
import { ItineraryService } from '../../../core/services/itinerary.service';
import { Itinerary, ItineraryItem, ItineraryWorkspace } from '../../../core/models/itinerary.model';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginPromptModalComponent } from '../../ui/modals/login-prompt-modal/login-prompt-modal.component';
import { UIStateService } from '../../../core/services/ui-state.service';
import { AlertService } from '../../../core/services/alert.service';
import { ItineraryExportService } from '../../../core/services/itinerary-export.service';
import { BuilderPoi } from '../../../core/models/builder.types';

@Component({
  selector: 'app-itinerary-builder',
  standalone: true,
  imports: [
    CommonModule,
    BuilderHeaderComponent,
    BuilderSidebarComponent,
    BuilderMapComponent,
    BuilderSummaryComponent,
    BuilderChatComponent,
    BuilderPoiEditorComponent,
    LoginPromptModalComponent
  ],
  templateUrl: './itinerary-builder.component.html',
  styleUrl: './itinerary-builder.component.css'
})
export class ItineraryBuilderComponent implements OnInit {
  showLoginPrompt = signal(false);
  workspaceError = signal<string | null>(null);
  workspace = signal<ItineraryWorkspace | null>(null);
  previewPoi = signal<BuilderPoi | null>(null);

  // New POI editor state
  editingPoi = signal<BuilderPoi | null>(null);
  editingItem = signal<ItineraryItem | null>(null);
  showPoiEditor = signal(false);

  // Mobile UX state
  mobileActiveTab = signal<'summary' | 'map' | 'ai' | 'tools'>('summary');

  ui = inject(UIStateService);
  private exportService = inject(ItineraryExportService);
  private targetUrl: string | null = null;

  constructor(
    itineraryService: ItineraryService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private alertService: AlertService
  ) {
    this.itineraryService = itineraryService;
  }

  itineraryService: ItineraryService;

  readonly allPois = computed(() => {
    const ws = this.workspace();
    if (!ws) return [] as BuilderPoi[];

    const accommodationPois: BuilderPoi[] = ws.accommodations.map((acc) => ({
      key: `accommodation-${acc.id}`,
      type: 'accommodation' as const,
      entityId: acc.id,
      title: acc.name,
      subtitle: acc.street || 'Hotel',
      latitude: acc.latitude,
      longitude: acc.longitude,
      itemTypeCode: 'ACCOMMODATION' as const,
      imageUrl: acc.imageUrl,
      price: acc.pricePerNight,
      rating: acc.stars
    }));

    const activityPois: BuilderPoi[] = ws.activities.map((activity) => ({
      key: `activity-${activity.id}`,
      type: 'activity' as const,
      entityId: activity.id,
      title: activity.name,
      subtitle: activity.category?.name || activity.street || 'Attività',
      latitude: activity.latitude,
      longitude: activity.longitude,
      categoryId: activity.categoryId,
      categoryName: activity.category?.name,
      itemTypeCode: 'ACTIVITY' as const,
      imageUrl: activity.imageUrl,
      price: activity.price,
      rating: activity.rating
    }));

    return [...accommodationPois, ...activityPois];
  });

  readonly savedPois = computed(() => {
    const current = this.itineraryService.itinerary();
    const index = new Map(this.allPois().map((poi) => [poi.key, poi]));

    return (current?.items || [])
      .slice()
      .sort((a, b) => {
        if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
        return a.orderInt - b.orderInt;
      })
      .map((item) => {
        const poi = item.accommodationId
          ? index.get(`accommodation-${item.accommodationId}`)
          : index.get(`activity-${item.activityId}`);

        if (poi) {
          return {
            ...poi,
            dayNumber: item.dayNumber,
            note: item.note,
            plannedStartAt: item.plannedStartAt,
            plannedEndAt: item.plannedEndAt,
            groupName: item.groupName,
            groupStartAt: item.groupStartAt,
            groupEndAt: item.groupEndAt
          } as BuilderPoi;
        }
        return null;
      })
      .filter((poi): poi is BuilderPoi => poi !== null);
  });

  readonly savedPoiKeys = computed(() => new Set(this.savedPois().map((poi) => poi.key)));

  readonly filteredPois = computed(() => {
    const selectedType = this.ui.selectedType();
    const selectedCategory = this.ui.selectedCategory();

    return this.allPois().filter((poi) => {
      if (selectedType !== 'all' && poi.type !== selectedType) return false;
      if (selectedCategory !== 'all' && poi.type === 'activity' && poi.categoryId !== selectedCategory) return false;
      return true;
    });
  });

  readonly filteredSavedPois = computed(() => {
    if (this.ui.mapView() === 'selected') return this.savedPois();
    const allowedKeys = new Set(this.filteredPois().map((poi) => poi.key));
    return this.savedPois().filter((poi) => allowedKeys.has(poi.key));
  });

  readonly mapAvailablePois = computed(() => {
    if (this.ui.mapView() !== 'all') return [] as BuilderPoi[];
    return this.filteredPois();
  });

  ngOnInit(): void {
    const current = this.itineraryService.itinerary();
    if (current) {
      this.bootstrapWorkspace(current);
      return;
    }

    if (!this.authService.IsAuthenticated()) {
      const hasStorageDraft = this.itineraryService.loadFromStorage();
      if (hasStorageDraft && this.itineraryService.itinerary()) {
        this.bootstrapWorkspace(this.itineraryService.itinerary()!);
      } else {
        this.seedFromRouteQuery();
      }
      return;
    }

    this.itineraryService.loadLatestFromBackend().subscribe(() => {
      const resolved = this.itineraryService.itinerary();
      if (resolved) {
        this.bootstrapWorkspace(resolved);
        return;
      }

      this.seedFromRouteQuery();
    });
  }

  private getLocationIdFromQuery(): number | null {
    const queryId = Number(this.route.snapshot.queryParams['locationId']);
    if (!queryId || Number.isNaN(queryId)) return null;
    return queryId;
  }

  private seedFromRouteQuery() {
    const query = this.route.snapshot.queryParams;
    const locationId = this.getLocationIdFromQuery();
    if (!locationId) {
      this.workspaceError.set('Nessuna destinazione selezionata. Scegli prima una città dal planner manuale.');
      return;
    }

    const start = typeof query['in'] === 'string' && query['in'] ? query['in'] : null;
    const end = typeof query['out'] === 'string' && query['out'] ? query['out'] : start;

    this.itineraryService.setCurrentItinerary(
      {
        name: query['dest'] ? `Viaggio a ${query['dest']}` : 'Il mio Viaggio',
        startDate: start,
        endDate: end,
        locationId,
        items: []
      },
      { autosave: false }
    );

    this.bootstrapWorkspace(this.itineraryService.itinerary()!);
  }

  private bootstrapWorkspace(itinerary: Itinerary) {
    const queryLocationId = this.getLocationIdFromQuery();
    const locationId = itinerary.locationId || queryLocationId;

    if (!locationId) {
      this.workspaceError.set('Impossibile aprire il builder: manca la destinazione del viaggio.');
      return;
    }

    if (!itinerary.locationId) {
      this.itineraryService.setCurrentItinerary({ ...itinerary, locationId }, { autosave: false });
    }

    this.loadWorkspace(locationId);
  }

  loadWorkspace(locationId: number) {
    this.workspaceError.set(null);

    this.itineraryService.getWorkspace(locationId).subscribe((ws) => {

      if (!ws || !ws.location) {
        this.workspaceError.set('Non siamo riusciti a caricare i dati della destinazione selezionata.');
        return;
      }

      this.workspace.set(ws);

      const current = this.itineraryService.itinerary();
      if (current) {
        // If we selected a new location, we might want to reset the itinerary items
        // because they belong to the previous location.
        // For now, let's just update the location and keep the items,
        // but typically changing city should probably clear the items or warn the user.
        this.itineraryService.setCurrentItinerary(
          {
            ...current,
            locationId: ws.location.id,
            location: ws.location,
            // If the user explicitly changed location from the header, we might want to reset
            items: current.locationId === ws.location.id ? current.items : []
          },
          { autosave: true }
        );
      }
    });
  }

  onSidebarFocused() {
    this.ui.setActiveSurface('sidebar');
  }

  onMapFocused() {
    this.ui.setActiveSurface('map');
    this.mobileActiveTab.set('map');
  }

  setMobileTab(tab: 'summary' | 'map' | 'ai' | 'tools') {
    this.ui.setMobileActiveTab(tab);
    if (tab === 'map') {
      this.ui.showSummary.set(false);
      this.onMapFocused();
    }
    if (tab === 'summary') {
      this.ui.showSummary.set(true);
    }
    if (tab === 'tools') {
      this.onSidebarFocused();
    }
    if (tab === 'ai') {
      this.ui.showChat.set(true);
    }
  }

  onPreviewPoi(poi: BuilderPoi) {
    this.previewPoi.set(poi);
    this.ui.showSummary.set(false);
    this.ui.setActiveSurface('map');
    if (window.innerWidth <= 992) {
      this.setMobileTab('map');
    }
  }

  onAddPoi(poi: BuilderPoi) {
    const current = this.itineraryService.itinerary();
    if (!current) return;

    const currentItems = [...(current.items || [])];
    const alreadyAdded = currentItems.some(
      (item) =>
        (poi.type === 'accommodation' && item.accommodationId === poi.entityId) ||
        (poi.type === 'activity' && item.activityId === poi.entityId)
    );

    if (alreadyAdded) {
      this.previewPoi.set(null);
      this.alertService.info('Elemento già presente nell’itinerario.');
      return;
    }

    const targetDay = this.ui.visibleDayRoute() === 'all'
      ? this.ui.selectedDay()
      : this.ui.visibleDayRoute();
    const safeTargetDay = typeof targetDay === 'number' && targetDay > 0 ? targetDay : 1;

    const maxOrder = currentItems.reduce((acc, item) => Math.max(acc, item.orderInt || 0), 0);
    const newItem: ItineraryItem = {
      dayNumber: safeTargetDay,
      orderInt: maxOrder + 1,
      itemTypeCode: poi.itemTypeCode,
      activityId: poi.type === 'activity' ? poi.entityId : undefined,
      accommodationId: poi.type === 'accommodation' ? poi.entityId : undefined
    };

    const nextItinerary = this.withExtendedEndDateIfNeeded({
      ...current,
      locationId: current.locationId || this.workspace()?.location?.id,
      location: current.location || this.workspace()?.location || undefined,
      items: [...currentItems, newItem]
    }, safeTargetDay);

    this.itineraryService.setCurrentItinerary(nextItinerary);

    this.previewPoi.set(null);
    this.alertService.success('Punto aggiunto e salvato automaticamente.');
  }

  onRemovePoi(poi: BuilderPoi) {
    const current = this.itineraryService.itinerary();
    if (!current || !current.items) return;

    const updatedItems = current.items.filter(item => {
      return !((poi.type === 'accommodation' && item.accommodationId === poi.entityId) ||
        (poi.type === 'activity' && item.activityId === poi.entityId));
    });

    if (updatedItems.length === current.items.length) {
      return;
    }

    this.itineraryService.setCurrentItinerary({
      ...current,
      items: updatedItems
    }, { autosave: true });

    this.alertService.success('Elemento rimosso dall\'itinerario.');
  }

  applyOptimizedOrder(optimizedPois: BuilderPoi[]) {
    const current = this.itineraryService.itinerary();
    if (!current || !current.items) return;

    // Create a map of key -> new positions
    const orderMap = new Map<string, { day: number, order: number }>();
    optimizedPois.forEach((poi, index) => {
      // getDisplayRoutePois optimizes within each day, so dayNumber is preserved or assigned
      orderMap.set(poi.key, { day: poi.dayNumber || 1, order: index + 1 });
    });

    const updatedItems = current.items.map(item => {
      const key = item.accommodationId ? `accommodation-${item.accommodationId}` : `activity-${item.activityId}`;
      const newPos = orderMap.get(key);
      if (newPos) {
        return { ...item, dayNumber: newPos.day, orderInt: newPos.order };
      }
      return item;
    });

    this.itineraryService.setCurrentItinerary({
      ...current,
      items: updatedItems
    }, { autosave: true });
  }

  onChangeLocationRequest() {
    const current = this.itineraryService.itinerary();
    this.router.navigate(['/itineraries/new'], {
      queryParams: {
        in: current?.startDate,
        out: current?.endDate
      }
    });
  }

  /**
   * Called when the user clicks explicitly on a link that takes them away from the builder.
   * e.g., the Home logo.
   */
  handleNavigationIntercept(url: string) {
    if (this.authService.IsAuthenticated()) {
      // Auto-save logic for logged-in users
      const current = this.itineraryService.itinerary();
      if (current) {
        // We sync with backend
        this.itineraryService.saveToBackend(current).subscribe(() => {
          this.router.navigate([url]);
        });
      } else {
        this.router.navigate([url]);
      }
    } else {
      // Guest users: show the "Login to save" prompt
      this.targetUrl = url;
      this.showLoginPrompt.set(true);
    }
  }

  handleSaveRequest() {
    // Header emitted a save request but user is NOT authenticated
    this.targetUrl = null; // No final navigation target, just want to save
    this.showLoginPrompt.set(true);
  }

  onLoginRedirect() {
    // Ensure the current draft is in localStorage so it can be reloaded after login
    const current = this.itineraryService.itinerary();
    if (current) {
      this.itineraryService.setCurrentItinerary(current);
    }
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
  }

  onContinueExit() {
    // User chooses to leave without saving
    this.itineraryService.clearDraft();
    if (this.targetUrl) {
      this.router.navigate([this.targetUrl]);
    }
    this.showLoginPrompt.set(false);
  }

  closeModal() {
    this.showLoginPrompt.set(false);
  }

  // ============ NEW POI EDITOR METHODS ============

  onEditPoi(poi: BuilderPoi) {
    const current = this.itineraryService.itinerary();
    if (!current || !current.items) return;

    const item = current.items.find(i =>
      (poi.type === 'accommodation' && i.accommodationId === poi.entityId) ||
      (poi.type === 'activity' && i.activityId === poi.entityId)
    );

    if (item) {
      this.editingPoi.set(poi);
      this.editingItem.set(item);
      this.showPoiEditor.set(true);
    }
  }

  onPoiEditorSave(updatedItem: ItineraryItem) {
    const current = this.itineraryService.itinerary();
    if (!current || !current.items) return;

    const updatedItems = current.items.map(item => {
      if (item === this.editingItem() ||
        (this.editingItem() &&
          ((this.editingItem()?.accommodationId && item.accommodationId === this.editingItem()?.accommodationId) ||
            (this.editingItem()?.activityId && item.activityId === this.editingItem()?.activityId)))) {
        return updatedItem;
      }
      return item;
    });

    this.itineraryService.setCurrentItinerary({
      ...current,
      items: updatedItems
    }, { autosave: true });

    this.alertService.success('Elemento modificato e salvato.');
  }

  onPoiEditorDelete() {
    const current = this.itineraryService.itinerary();
    if (!current || !current.items) return;

    const editingItem = this.editingItem();
    if (!editingItem) return;

    const updatedItems = current.items.filter(item => {
      return !((editingItem.accommodationId && item.accommodationId === editingItem.accommodationId) ||
        (editingItem.activityId && item.activityId === editingItem.activityId));
    });

    this.itineraryService.setCurrentItinerary({
      ...current,
      items: updatedItems
    }, { autosave: true });

    this.alertService.success('Elemento rimosso dall\'itinerario.');
  }

  onPoiEditorClose() {
    this.showPoiEditor.set(false);
    this.editingPoi.set(null);
    this.editingItem.set(null);
  }

  // ============ EXPORT METHODS ============

  onExportItinerary(format: 'pdf' | 'html' | 'json') {
    const current = this.itineraryService.itinerary();
    const ws = this.workspace();

    if (!current || !ws) {
      this.alertService.error('Errore durante l\'esportazione.');
      return;
    }

    const poiMap = new Map<string, BuilderPoi>();
    for (const poi of this.allPois()) {
      poiMap.set(poi.key, poi);
    }

    const exportData = this.exportService.generateExport(
      current,
      current.items || [],
      poiMap,
      ws.location || undefined
    );

    const fileName = this.buildExportFileName(current.name || 'itinerary', format);

    if (format === 'json') {
      const json = this.exportService.exportToJSON(exportData);
      this.exportService.downloadFile(json, fileName, 'application/json;charset=utf-8');
      this.alertService.success('Export JSON scaricato con successo.');
      return;
    }

    const printableHtml = this.exportService.exportToHTML(exportData);

    if (format === 'html') {
      this.exportService.downloadFile(printableHtml, fileName, 'text/html;charset=utf-8');
      this.alertService.success('Export HTML scaricato con successo.');
      return;
    }

    this.openPrintableWindow(printableHtml);
  }

  private buildExportFileName(baseName: string, format: 'pdf' | 'html' | 'json'): string {
    const safeBaseName = baseName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-\s_]/g, '')
      .replace(/\s+/g, '-');

    const dateSuffix = new Date().toISOString().split('T')[0];
    const extension = format === 'json' ? 'json' : format === 'html' ? 'html' : 'pdf';

    return `${safeBaseName || 'itinerary'}-${dateSuffix}.${extension}`;
  }

  private openPrintableWindow(content: string) {
    const pdfWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!pdfWindow) {
      this.alertService.error('Impossibile aprire la finestra di stampa.');
      return;
    }

    pdfWindow.document.open();
    pdfWindow.document.write(content);
    pdfWindow.document.close();

    setTimeout(() => {
      pdfWindow.focus();
      pdfWindow.print();
    }, 400);
  }

  private withExtendedEndDateIfNeeded(itinerary: Itinerary, targetDay: number): Itinerary {
    if (!itinerary.startDate || targetDay <= 1) {
      return itinerary;
    }

    const startDate = new Date(itinerary.startDate);
    if (Number.isNaN(startDate.getTime())) {
      return itinerary;
    }

    const requiredEndDate = new Date(startDate);
    requiredEndDate.setDate(requiredEndDate.getDate() + Math.max(0, targetDay - 1));
    const requiredEndDateString = requiredEndDate.toISOString().split('T')[0];

    if (!itinerary.endDate) {
      return {
        ...itinerary,
        endDate: requiredEndDateString
      };
    }

    const currentEndDate = new Date(itinerary.endDate);
    if (Number.isNaN(currentEndDate.getTime()) || currentEndDate < requiredEndDate) {
      return {
        ...itinerary,
        endDate: requiredEndDateString
      };
    }

    return itinerary;
  }
}
