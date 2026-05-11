import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  effect,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import Location from '../../../../core/models/location.model';
import { Itinerary } from '../../../../core/models/itinerary.model';
import { BuilderPoi } from '../../../../core/models/builder.types';
import { UIStateService } from '../../../../core/services/ui-state.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-builder-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './builder-map.component.html',
  styleUrl: './builder-map.component.css'
})
export class BuilderMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapRoot', { static: true }) mapRoot!: ElementRef<HTMLDivElement>;

  @Input() itinerary: Itinerary | null = null;
  @Input() isPreview = false;
  @Input() location: Location | null = null;
  @Input() savedPois: BuilderPoi[] = [];
  @Input() routePois: BuilderPoi[] = [];
  @Input() availablePois: BuilderPoi[] = [];
  @Input() previewPoi: BuilderPoi | null = null;
  @Input() markerColor = '#22c55e';

  @Output() mapFocused = new EventEmitter<void>();
  @Output() orderChanged = new EventEmitter<BuilderPoi[]>();
  @Output() addPoi = new EventEmitter<BuilderPoi>();
  @Output() removePoi = new EventEmitter<BuilderPoi>();

  private map?: L.Map;
  private locationLayer!: L.LayerGroup;
  private savedLayer!: L.LayerGroup;
  private availableLayer!: L.MarkerClusterGroup;
  private previewLayer!: L.LayerGroup;
  private routeLayer!: L.LayerGroup;
  private endpointLayer!: L.LayerGroup;
  private routeRequestId = 0;
  private resizeObserver?: ResizeObserver;
  private readonly ui = inject(UIStateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly defaultDayPalette = ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ef4444', '#a855f7', '#14b8a6'];
  private displayRoutePois: BuilderPoi[] = [];
  private lastRouteFingerprint = '';
  private geometryCache = new Map<number, L.LatLng[]>();
  private metadataCache = new Map<number, { distanceKm: number; durationMin: number }>();

  routeInfo: { distanceKm: number; durationMin: number; steps: number } | null = null;
  dayRouteInfo: Array<{ day: number; distanceKm: number; durationMin: number; color: string }> = [];
  routeError: string | null = null;
  isRouteLoading = false;
  googleMapsUrl: string | null = null;


  get routePanelTitle(): string {
    const visibleDay = this.ui.visibleDayRoute();
    return visibleDay === 'all' ? 'Percorso itinerario' : `Percorso Giorno ${visibleDay}`;
  }

  /** Mostra la barra compatta solo quando un giorno specifico è selezionato */
  get routePanelVisible(): boolean {
    return this.ui.visibleDayRoute() !== 'all';
  }

  constructor() {
    effect(() => {
      // Subscribe to relevant UI signals
      this.ui.dayRouteColors();
      this.ui.markerColor();
      this.ui.visibleDayRoute();

      // Trigger refresh when they change
      if (this.map) {
        this.refreshLayers(false);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initializeLayers();

    this.map = L.map(this.mapRoot.nativeElement, {
      zoomControl: false,
      attributionControl: true,
      closePopupOnClick: false // Allow multiple popups to stay open
    }).setView([41.9028, 12.4964], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.locationLayer.addTo(this.map);
    this.availableLayer.addTo(this.map);
    this.savedLayer.addTo(this.map);
    this.previewLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);
    this.endpointLayer.addTo(this.map);

    this.map.on('click', () => this.mapFocused.emit());
    this.map.on('popupopen', (e: L.PopupEvent) => this.bindPopupActions(e.popup));

    this.refreshLayers(true);

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.map) return;
      requestAnimationFrame(() => this.map?.invalidateSize({ animate: false }));
    });

    this.resizeObserver.observe(this.mapRoot.nativeElement);
  }

  private initializeLayers(): void {
    this.locationLayer = L.layerGroup();
    this.savedLayer = L.layerGroup();
    this.previewLayer = L.layerGroup();
    this.routeLayer = L.layerGroup();
    this.endpointLayer = L.layerGroup();

    // Robust detection for MarkerClusterGroup (Vite/ESM production fix)
    let clusterFn: any = (L as any).markerClusterGroup || (L as any).MarkerClusterGroup;

    // Fallback: Check if it's attached to the global L or needs manual reference
    if (!clusterFn && typeof window !== 'undefined' && (window as any).L) {
      clusterFn = (window as any).L.markerClusterGroup || (window as any).L.MarkerClusterGroup;
    }

    if (clusterFn) {
      this.availableLayer = clusterFn({
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            className: 'custom-cluster-icon',
            html: `<div style="width: 34px; height: 34px; border-radius: 50%; background: rgba(30, 41, 59, 0.9); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 2px solid #3b82f6; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 700; font-size: 13px; font-family: 'Inter', sans-serif;">${count}</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });
        }
      });
    } else {
      console.warn('MarkerClusterGroup not found, falling back to LayerGroup');
      this.availableLayer = L.layerGroup() as any;
    }
  }

  private bindPopupActions(popup: L.Popup) {
    // Wait for the next macro-task to ensure Leaflet has finished rendering the popup content
    setTimeout(() => {
      const container = popup.getElement();
      if (!container) return;

      const addBtn = container.querySelector('.popup-action-btn--add') as HTMLElement;
      const removeBtn = container.querySelector('.popup-action-btn--remove') as HTMLElement;
      const closeBtn = container.querySelector('.popup-close-btn') as HTMLElement;

      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.map?.closePopup(popup);
        });
      }

      if (addBtn) {
        addBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const key = addBtn.getAttribute('data-poi-key');
          const poi = this.findPoiByKey(key);
          if (poi) {
            this.addPoi.emit(poi);
            this.map?.closePopup(popup);
          }
        });
      }

      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const key = removeBtn.getAttribute('data-poi-key');
          const poi = this.findPoiByKey(key);
          if (poi) {
            this.removePoi.emit(poi);
            this.map?.closePopup(popup);
          }
        });
      }
    }, 10);
  }

  private findPoiByKey(key: string | null): BuilderPoi | undefined {
    if (!key) return undefined;
    return this.availablePois.find(p => p.key === key) ||
      this.savedPois.find(p => p.key === key) ||
      (this.previewPoi?.key === key ? this.previewPoi : undefined);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;

    const locationChanged = !!changes['location'];
    this.refreshLayers(locationChanged);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;

    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }

  private refreshLayers(recenterForLocation = false) {
    if (!this.map) return;

    this.locationLayer.clearLayers();
    this.savedLayer.clearLayers();
    this.availableLayer.clearLayers();
    this.previewLayer.clearLayers();
    this.routeLayer.clearLayers();
    this.endpointLayer.clearLayers();

    if (this.location && recenterForLocation) {
      this.map.setView([this.location.latitude, this.location.longitude], 13);
    }

    const availableMarkers: L.Marker[] = [];
    for (const poi of this.availablePois) {
      const icon = this.createCategoryIcon(poi.categoryName, poi.type);
      const marker = L.marker([poi.latitude, poi.longitude], { icon });

      marker.bindPopup(this.createPopupHtml(poi), { autoClose: false, closeOnClick: false, closeButton: false });
      availableMarkers.push(marker);
    }

    // Safely add markers regardless of whether it's a ClusterGroup or a LayerGroup
    if ((this.availableLayer as any).addLayers) {
      (this.availableLayer as any).addLayers(availableMarkers);
    } else {
      availableMarkers.forEach(m => this.availableLayer.addLayer(m));
    }

    this.displayRoutePois = this.getDisplayRoutePois();
    const routeOrder = this.buildRouteOrderByDay(this.displayRoutePois);

    const customColors = this.ui.dayRouteColors();
    const visibleDay = this.ui.visibleDayRoute();

    for (const poi of this.savedPois) {
      const day = poi.dayNumber || 1;
      // Filter by visible day if not 'all'
      if (visibleDay !== 'all' && day !== visibleDay) continue;

      const orderNumber = routeOrder.get(poi.key);

      if (orderNumber) {
        const day = poi.dayNumber || 1;
        const dayColor = customColors[day] || this.defaultDayPalette[(day - 1) % this.defaultDayPalette.length];
        const stopLabel = visibleDay === 'all'
          ? `Giorno ${day} - Tappa ${orderNumber}`
          : `Tappa ${orderNumber}`;
        const icon = this.createStopIcon(orderNumber, dayColor, poi.type === 'accommodation');
        const marker = L.marker([poi.latitude, poi.longitude], { icon }).bindPopup(
          this.createPopupHtml(poi, stopLabel, dayColor), { autoClose: false, closeOnClick: false, closeButton: false }
        );
        this.savedLayer.addLayer(marker);
        continue;
      }

      let marker: L.Layer;
      const mColor = this.ui.markerColor();

      if (poi.type === 'accommodation') {
        const icon = this.createTypeIcon('accommodation', mColor);
        marker = L.marker([poi.latitude, poi.longitude], { icon });
      } else {
        marker = L.circleMarker([poi.latitude, poi.longitude], {
          radius: 7,
          color: mColor,
          fillColor: mColor,
          fillOpacity: 0.82,
          weight: 2
        });
      }

      marker.bindPopup(this.createPopupHtml(poi, "Salvato nell'itinerario"), { autoClose: false, closeOnClick: false, closeButton: false });
      this.savedLayer.addLayer(marker);
    }

    if (this.previewPoi) {
      const icon = this.createCategoryIcon(this.previewPoi.categoryName, this.previewPoi.type);
      const previewMarker = L.marker([this.previewPoi.latitude, this.previewPoi.longitude], {
        icon: icon,
        title: `Anteprima: ${this.previewPoi.title}`,
        zIndexOffset: 1000
      }).bindPopup(this.createPopupHtml(this.previewPoi, 'Anteprima'), { autoClose: false, closeOnClick: false, closeButton: false });

      this.previewLayer.addLayer(previewMarker);
      this.map.panTo([this.previewPoi.latitude, this.previewPoi.longitude]);

      // Open the popup immediately
      setTimeout(() => previewMarker.openPopup(), 50);
    }

    // If no route but we have saved POIs, zoom to them
    if (this.savedPois.length > 0 && this.ui.visibleDayRoute() === 'all') {
      const bounds = L.latLngBounds(this.savedPois.map(p => [p.latitude, p.longitude]));
      this.map.fitBounds(bounds.pad(0.2));
    } else if (this.savedPois.length === 0 && this.location && recenterForLocation) {
      this.map.setView([this.location.latitude, this.location.longitude], 13);
    }

    // Defer route calculation to next tick
    setTimeout(() => {
      void this.refreshRoute();
    }, 0);
  }

  private async refreshRoute() {
    if (!this.map) return;

    const visibleDay = this.ui.visibleDayRoute();

    const points = this.displayRoutePois
      .filter((poi) => Number.isFinite(poi.latitude) && Number.isFinite(poi.longitude))
      .filter((poi) => visibleDay === 'all' || (poi.dayNumber || 1) === visibleDay)
      .map((poi) => ({
        lat: poi.latitude,
        lng: poi.longitude,
        dayNumber: poi.dayNumber || 1,
        title: poi.title
      }));

    this.googleMapsUrl = this.buildGoogleMapsUrl(points);
    this.dayRouteInfo = [];

    if (points.length < 2) {
      this.routeInfo = null;
      this.routeError = null;
      this.isRouteLoading = false;
      this.drawEndpointMarkers(this.displayRoutePois);
      return;
    }

    const currentFingerprint = points.map(p => `${p.lat},${p.lng},${p.dayNumber}`).join('|');
    const onlyColorsChanged = currentFingerprint === this.lastRouteFingerprint;
    this.lastRouteFingerprint = currentFingerprint;

    if (!onlyColorsChanged) {
      this.geometryCache.clear();
      this.metadataCache.clear();
    }

    const requestId = ++this.routeRequestId;

    // Use a microtask to defer state changes and avoid ExpressionChangedAfterItHasBeenCheckedError
    // when refreshRoute is called from ngAfterViewInit or ngOnChanges
    Promise.resolve().then(() => {
      if (requestId !== this.routeRequestId) return;
      this.isRouteLoading = !onlyColorsChanged;
      this.routeError = null;
      this.dayRouteInfo = []; // Reset info while loading to avoid stale data
      this.cdr.detectChanges();
    });

    try {
      const customColors = this.ui.dayRouteColors();
      const dayBuckets = new Map<number, Array<{ lat: number; lng: number; title: string }>>();

      for (const point of points) {
        const bucket = dayBuckets.get(point.dayNumber) || [];
        bucket.push({ lat: point.lat, lng: point.lng, title: point.title });
        dayBuckets.set(point.dayNumber, bucket);
      }

      const sortedDays = Array.from(dayBuckets.keys()).sort((a, b) => a - b);
      let totalDistance = 0;
      let totalDuration = 0;
      const allDrawnPoints: L.LatLng[] = [];

      for (let index = 0; index < sortedDays.length; index += 1) {
        if (requestId !== this.routeRequestId) return;

        const day = sortedDays[index];
        const dayPoints = dayBuckets.get(day) || [];

        // Skip if not the visible day
        if (visibleDay !== 'all' && day !== visibleDay) continue;

        const dayColor = customColors[day] || this.defaultDayPalette[index % this.defaultDayPalette.length];

        if (dayPoints.length < 2) {
          this.dayRouteInfo.push({
            day,
            distanceKm: 0,
            durationMin: 0,
            color: dayColor
          });
          continue;
        }

        let latLngs: L.LatLng[] = [];
        let dayDistanceKm = 0;
        let dayDurationMin = 0;

        if (onlyColorsChanged && this.geometryCache.has(day)) {
          latLngs = this.geometryCache.get(day)!;
          const meta = this.metadataCache.get(day)!;
          dayDistanceKm = meta.distanceKm;
          dayDurationMin = meta.durationMin;
        } else {
          const coordinateString = dayPoints.map((p) => `${p.lng},${p.lat}`).join(';');
          let response: Response;
          try {
            // Priority to routing.openstreetmap.de (FOSS server, often more stable for direct browser CORS)
            response = await fetch(
              `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordinateString}?overview=full&geometries=geojson&steps=false`
            );

            if (!response.ok || response.status === 502 || response.status === 429) {
              throw new Error('Fallback needed');
            }
          } catch (e) {
            // Fallback to project-osrm.org demo server
            response = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson&steps=false`
            );
          }

          if (!response.ok) {
            if (response.status === 502) throw new Error('Servitore di routing temporaneamente non disponibile (502)');
            throw new Error(`Errore server: ${response.status}`);
          }

          const payload = await response.json();

          if (requestId !== this.routeRequestId) return;

          if (!response.ok || payload?.code !== 'Ok' || !Array.isArray(payload?.routes) || !payload.routes[0]) {
            console.error('OSRM API Error:', payload);
            throw new Error('Percorso non disponibile');
          }

          const route = payload.routes[0];
          latLngs = (route.geometry?.coordinates || []).map((coord: number[]) => L.latLng(coord[1], coord[0]));

          if (latLngs.length < 2) {
            throw new Error('Geometria percorso non valida');
          }

          dayDistanceKm = Number((route.distance / 1000).toFixed(1));
          dayDurationMin = Math.max(1, Math.round(route.duration / 60));

          this.geometryCache.set(day, latLngs);
          this.metadataCache.set(day, { distanceKm: dayDistanceKm, durationMin: dayDurationMin });
        }

        allDrawnPoints.push(...latLngs);

        this.routeLayer.addLayer(
          L.polyline(latLngs, {
            color: '#0f172a',
            opacity: 0.3,
            weight: 10,
            lineCap: 'round',
            lineJoin: 'round'
          })
        );

        this.routeLayer.addLayer(
          L.polyline(latLngs, {
            color: dayColor,
            opacity: 0.95,
            weight: 5,
            lineCap: 'round',
            lineJoin: 'round'
          })
        );

        totalDistance += dayDistanceKm;
        totalDuration += dayDurationMin;
        this.dayRouteInfo.push({
          day,
          distanceKm: dayDistanceKm,
          durationMin: dayDurationMin,
          color: dayColor
        });
      }

      this.routeInfo = {
        distanceKm: Number(totalDistance.toFixed(1)),
        durationMin: totalDuration,
        steps: points.length
      };

      this.drawEndpointMarkers(this.displayRoutePois);

      if (!this.previewPoi && allDrawnPoints.length > 1) {
        const bounds = L.latLngBounds(allDrawnPoints);
        this.map.fitBounds(bounds.pad(0.18));
      }
    } catch {
      if (requestId !== this.routeRequestId) return;

      const straightLine = points.map((p) => L.latLng(p.lat, p.lng));
      this.routeLayer.addLayer(
        L.polyline(straightLine, {
          color: '#fb7185',
          opacity: 0.9,
          weight: 4,
          dashArray: '10 8',
          lineCap: 'round',
          lineJoin: 'round'
        })
      );

      this.routeInfo = null;
      this.dayRouteInfo = [];
      this.routeError = 'Percorso stradale non disponibile: mostrata una linea indicativa tra le tappe.';
      this.drawEndpointMarkers(this.displayRoutePois);
    } finally {
      if (requestId === this.routeRequestId) {
        this.isRouteLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  private drawEndpointMarkers(pois: BuilderPoi[]) {
    this.endpointLayer.clearLayers();

    if (!pois.length) return;

    const visibleDay = this.ui.visibleDayRoute();
    const visiblePois = pois.filter((poi) => visibleDay === 'all' || (poi.dayNumber || 1) === visibleDay);

    if (!visiblePois.length) return;

    // Group by day
    const dayGroups = new Map<number, BuilderPoi[]>();
    for (const poi of visiblePois) {
      const day = poi.dayNumber || 1;
      const group = dayGroups.get(day) || [];
      group.push(poi);
      dayGroups.set(day, group);
    }

    const sortedDays = Array.from(dayGroups.keys()).sort((a, b) => a - b);
    const customColors = this.ui.dayRouteColors();
    for (let i = 0; i < sortedDays.length; i++) {
      const day = sortedDays[i];
      const dayPois = dayGroups.get(day)!;
      if (dayPois.length < 1) continue;

      const dayColor = customColors[day] || this.defaultDayPalette[i % this.defaultDayPalette.length];

      const start = dayPois[0];
      const end = dayPois[dayPois.length - 1];

      // Labels
      const startLabel = 'START';
      const endLabel = 'END';

      // Start marker
      const startIcon = this.createEndpointIcon(startLabel, dayColor);
      const startMarker = L.marker([start.latitude, start.longitude], {
        icon: startIcon,
        title: `Partenza Giorno ${day}: ${start.title}`
      }).bindPopup(this.createPopupHtml(start, `GIORNO ${day} - PARTENZA`, dayColor), { autoClose: false, closeOnClick: false, closeButton: false });
      this.endpointLayer.addLayer(startMarker);

      // End marker (only if different from start)
      if (dayPois.length > 1) {
        const endIcon = this.createEndpointIcon(endLabel, dayColor);
        const endMarker = L.marker([end.latitude, end.longitude], {
          icon: endIcon,
          title: `Arrivo Giorno ${day}: ${end.title}`
        }).bindPopup(this.createPopupHtml(end, `GIORNO ${day} - ARRIVO`, dayColor), { autoClose: false, closeOnClick: false, closeButton: false });
        this.endpointLayer.addLayer(endMarker);
      }
    }
  }

  private buildRouteOrderByDay(pois: BuilderPoi[]): Map<string, number> {
    const orderMap = new Map<string, number>();
    const dayCounters = new Map<number, number>();

    for (const poi of pois) {
      const day = poi.dayNumber || 1;
      const nextOrder = (dayCounters.get(day) || 0) + 1;
      dayCounters.set(day, nextOrder);
      orderMap.set(poi.key, nextOrder);
    }

    return orderMap;
  }

  private createPopupHtml(poi: BuilderPoi, label?: string, labelColor?: string): string {
    const isHotel = poi.itemTypeCode === 'ACCOMMODATION' || poi.type === 'accommodation';
    const startLabel = isHotel ? 'Check-in' : 'Inizio';
    const endLabel = isHotel ? 'Check-out' : 'Fine';

    const formatDate = (dateStr?: string | null) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleString('it-IT', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formattedStart = formatDate(poi.plannedStartAt);
    const formattedEnd = formatDate(poi.plannedEndAt);
    const formattedGroupStart = formatDate(poi.groupStartAt);
    const formattedGroupEnd = formatDate(poi.groupEndAt);

    const gMapsLink = `https://www.google.com/maps/search/?api=1&query=${poi.latitude},${poi.longitude}`;
    const gSearchLink = `https://www.google.com/search?q=${encodeURIComponent(poi.title + ' ' + (poi.subtitle || ''))}`;

    const isSaved = this.savedPois.some(p => p.key === poi.key);

    // Fallback image for hotels if imageUrl is missing
    let finalImageUrl = poi.imageUrl;

    // Check if imageUrl is relative
    if (finalImageUrl && !finalImageUrl.startsWith('http') && !finalImageUrl.startsWith('data:')) {
      finalImageUrl = `${environment.apiUrl}${finalImageUrl.startsWith('/') ? '' : '/'}${finalImageUrl}`;
    }

    if (!finalImageUrl && isHotel) {
      finalImageUrl = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800';
    }

    return `
      <div class="map-popup-card">
        <button class="popup-close-btn" title="Chiudi">&times;</button>
        ${label ? `<div class="popup-label" style="background: ${labelColor || 'var(--accent-color)'}">${label}</div>` : ''}
        ${finalImageUrl ? `
          <div class="popup-image" style="background-image: url('${finalImageUrl}')"></div>
        ` : ''}
        <div class="popup-content">
          <h5 class="popup-title">${poi.title}</h5>
          ${poi.subtitle ? `<div class="popup-subtitle"><i class="bi bi-geo-alt"></i> ${poi.subtitle}</div>` : ''}
          
          <div class="popup-meta" style="display: flex; gap: 12px; margin-bottom: 10px; font-size: 0.75rem; font-weight: 600;">
            ${poi.rating ? `
              <span class="popup-rating" style="color: #fbbf24; display: flex; align-items: center; gap: 4px;">
                <i class="bi bi-star-fill"></i> ${poi.rating}
              </span>
            ` : ''}
            ${poi.price ? `
              <span class="popup-price" style="color: var(--accent-color);">
                ${poi.price}€
              </span>
            ` : ''}
          </div>

          ${poi.note ? `
            <div class="popup-note">
              <i class="bi bi-sticky"></i>
              <span>${poi.note}</span>
            </div>
          ` : ''}

          <div class="popup-actions-stack">
             <div class="popup-actions-row">
               <a href="${gMapsLink}" target="_blank" class="popup-pill-link popup-pill-link--maps">
                 <i class="bi bi-geo-alt"></i> Maps
               </a>
               <a href="${gSearchLink}" target="_blank" class="popup-pill-link popup-pill-link--google">
                 <i class="bi bi-google"></i> Google
               </a>
             </div>

             ${isSaved ? `
               <button class="popup-action-btn popup-action-btn--remove" data-poi-key="${poi.key}">
                 <i class="bi bi-dash-circle"></i> Rimuovi dal percorso
               </button>
             ` : `
               <button class="popup-action-btn popup-action-btn--add" data-poi-key="${poi.key}">
                 <i class="bi bi-plus-circle"></i> Aggiungi al percorso
               </button>
             `}
          </div>
          ${poi.groupName ? `
            <div class="popup-group" style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08);">
              <div class="popup-subtitle popup-subtitle--group">
                <i class="bi bi-collection"></i>
                <span>${poi.groupName}</span>
              </div>
              ${(formattedGroupStart || formattedGroupEnd) ? `
                <div class="popup-planning popup-planning--group">
                  ${formattedGroupStart ? `
                    <div class="planning-item">
                      <span class="p-label">Inizio gruppo:</span>
                      <span class="p-value">${formattedGroupStart}</span>
                    </div>
                  ` : ''}
                  ${formattedGroupEnd ? `
                    <div class="planning-item">
                      <span class="p-label">Fine gruppo:</span>
                      <span class="p-value">${formattedGroupEnd}</span>
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${(formattedStart || formattedEnd) ? `
            <div class="popup-planning" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08);">
              ${formattedStart ? `
                <div class="planning-item">
                  <span class="p-label">${startLabel}:</span>
                  <span class="p-value">${formattedStart}</span>
                </div>
              ` : ''}
              ${formattedEnd ? `
                <div class="planning-item">
                  <span class="p-label">${endLabel}:</span>
                  <span class="p-value">${formattedEnd}</span>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private createStopIcon(orderNumber: number, color: string, isAccommodation = false): L.DivIcon {
    const iconHtml = isAccommodation
      ? `<i class="bi bi-building" style="font-size: 8px; margin-right: 2px;"></i>${orderNumber}`
      : orderNumber;

    return L.divIcon({
      className: 'route-stop-icon',
      html: `<div style="width:28px;height:28px;border-radius:999px;background:${color};border:2px solid #f8fafc;box-shadow:0 4px 10px rgba(2,6,23,0.35);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:800;font-size:12px;">${iconHtml}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  private getCategoryVisuals(categoryName?: string, type?: 'accommodation' | 'activity'): { icon: string, color: string } {
    if (type === 'accommodation') return { icon: 'bi-building', color: '#3b82f6' }; // blue
    if (!categoryName) return { icon: 'bi-geo-alt-fill', color: '#64748b' }; // slate

    const n = categoryName.toLowerCase();
    if (n.includes('muse') || n.includes('monument') || n.includes('storico')) return { icon: 'bi-bank', color: '#f59e0b' }; // amber
    if (n.includes('food') || n.includes('risto') || n.includes('cucina') || n.includes('bar') || n.includes('caffe')) return { icon: 'bi-cup-hot', color: '#ef4444' }; // red
    if (n.includes('night') || n.includes('club')) return { icon: 'bi-moon-stars', color: '#8b5cf6' }; // violet
    if (n.includes('park') || n.includes('parco') || n.includes('nature') || n.includes('naturale')) return { icon: 'bi-tree', color: '#22c55e' }; // green
    if (n.includes('shop') || n.includes('negozi') || n.includes('commerciali')) return { icon: 'bi-bag', color: '#ec4899' }; // pink
    if (n.includes('sport') || n.includes('fitness') || n.includes('arrampicata')) return { icon: 'bi-trophy', color: '#f97316' }; // orange
    if (n.includes('spa') || n.includes('wellness') || n.includes('bagni')) return { icon: 'bi-flower2', color: '#06b6d4' }; // cyan
    if (n.includes('arte') || n.includes('galler') || n.includes('artigianato')) return { icon: 'bi-palette', color: '#d946ef' }; // fuchsia
    if (n.includes('beach') || n.includes('spiaggia') || n.includes('cascate')) return { icon: 'bi-water', color: '#0ea5e9' }; // light blue
    if (n.includes('chies') || n.includes('cattedral')) return { icon: 'bi-bell', color: '#a855f7' }; // purple

    return { icon: 'bi-geo-alt-fill', color: '#10b981' }; // emerald
  }

  private createCategoryIcon(categoryName: string | undefined, type: 'accommodation' | 'activity'): L.DivIcon {
    const { icon, color } = this.getCategoryVisuals(categoryName, type);
    return L.divIcon({
      className: 'poi-category-icon',
      html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:14px;"><i class="bi ${icon}"></i></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  private createTypeIcon(type: 'accommodation' | 'activity', color: string): L.DivIcon {
    const icon = type === 'accommodation' ? 'bi-building' : 'bi-geo-alt-fill';
    return L.divIcon({
      className: 'poi-type-icon',
      html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid #f8fafc;box-shadow:0 2px 6px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:12px;"><i class="bi ${icon}"></i></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  private createEndpointIcon(label: string, color: string): L.DivIcon {
    const width = Math.max(52, label.length * 8 + 20);
    return L.divIcon({
      className: 'route-endpoint-icon',
      html: `<div style="padding:0 10px;height:26px;border-radius:999px;background:${color};border:2px solid #f8fafc;box-shadow:0 6px 14px rgba(2,6,23,0.45);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:800;font-size:10px;letter-spacing:0.03em;white-space:nowrap;">${label}</div>`,
      iconSize: [width, 26],
      iconAnchor: [width / 2, 13]
    });
  }

  private createPreviewPinIcon(): L.DivIcon {
    return L.divIcon({
      className: 'preview-pin-icon',
      html: `
        <div style="position:relative;width:24px;height:34px;">
          <div style="position:absolute;left:0;top:0;width:24px;height:24px;background:#ef4444;border:2px solid #fee2e2;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 6px 14px rgba(127,29,29,0.45);"></div>
          <div style="position:absolute;left:7px;top:7px;width:8px;height:8px;background:#ffffff;border-radius:50%;box-shadow:0 0 0 1px rgba(185,28,28,0.25);"></div>
        </div>
      `,
      iconSize: [24, 34],
      iconAnchor: [12, 34],
      popupAnchor: [0, -30]
    });
  }

  private getDisplayRoutePois(): BuilderPoi[] {
    return [...this.routePois].filter(
      (poi) => Number.isFinite(poi.latitude) && Number.isFinite(poi.longitude)
    );
  }

  private buildGoogleMapsUrl(points: Array<{ lat: number; lng: number }>): string | null {
    if (points.length < 2) return null;

    const maxWaypoints = 8;
    const origin = `${points[0].lat},${points[0].lng}`;
    const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
    const waypointPoints = points.slice(1, -1).slice(0, maxWaypoints);
    const waypointParam = waypointPoints.map((p) => `${p.lat},${p.lng}`).join('|');

    const params = new URLSearchParams({
      api: '1',
      origin,
      destination,
      travelmode: 'driving'
    });

    if (waypointParam) {
      params.set('waypoints', waypointParam);
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
}
