import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UIStateService {
  readonly showSidebar = signal(true);
  readonly showSidebarRail = signal(true);
  readonly showChat = signal(false);
  readonly selectedCategory = signal<number | 'all'>('all');
  readonly selectedType = signal<'all' | 'accommodation' | 'activity'>('all');
  readonly mapView = signal<'selected' | 'all'>('selected');
  readonly activeSurface = signal<'sidebar' | 'map'>('sidebar');
  readonly markerColor = signal('#22c55e'); // Default green
  readonly showSummary = signal(false);
  readonly dayRouteColors = signal<Record<number, string>>({});
  readonly visibleDayRoute = signal<number | 'all'>('all');
  readonly selectedDay = signal<number>(1);
  /** Modalità ordine percorso: fedele all'itinerario o ottimizzato geograficamente */
  readonly routeOrderMode = signal<'original' | 'optimized'>('original');
  readonly mobileActiveTab = signal<'summary' | 'map' | 'ai' | 'tools'>('tools');

  setMobileActiveTab(tab: 'summary' | 'map' | 'ai' | 'tools') {
    this.mobileActiveTab.set(tab);
  }

  setRouteOrderMode(mode: 'original' | 'optimized') {
    this.routeOrderMode.set(mode);
  }

  private readonly defaultDayPalette = ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ef4444', '#a855f7', '#14b8a6'];

  toggleSidebar() {
    this.showSidebar.update(v => !v);
  }

  toggleSidebarRail() {
    this.showSidebarRail.update(v => !v);
  }

  toggleChat() {
    this.showChat.update(v => !v);
  }

  setCategory(categoryId: number | 'all') {
    this.selectedCategory.set(categoryId);
  }

  setType(type: 'all' | 'accommodation' | 'activity') {
    this.selectedType.set(type);
  }

  setMapView(mode: 'selected' | 'all') {
    this.mapView.set(mode);
  }

  setActiveSurface(surface: 'sidebar' | 'map') {
    this.activeSurface.set(surface);
  }

  setMarkerColor(color: string) {
    this.markerColor.set(color);
  }

  setDayColor(day: number, color: string) {
    this.dayRouteColors.update(prev => ({ ...prev, [day]: color }));
  }

  ensureDayColor(day: number): string {
    const current = this.dayRouteColors()[day];
    if (current) {
      return current;
    }

    const randomColor = this.generateRandomDayColor();
    this.setDayColor(day, randomColor);
    return randomColor;
  }

  setVisibleDayRoute(day: number | 'all') {
    this.visibleDayRoute.set(day);
    // If we select a specific day for the route, also update the active day for adding items
    if (day !== 'all') {
      this.selectedDay.set(day);
    }
  }

  setSelectedDay(day: number) {
    this.selectedDay.set(day);
  }

  getDefaultDayColor(day: number): string {
    return this.dayRouteColors()[day] || this.defaultDayPalette[(day - 1) % this.defaultDayPalette.length];
  }

  private generateRandomDayColor(): string {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 65 + Math.floor(Math.random() * 20);
    const lightness = 48 + Math.floor(Math.random() * 10);

    return this.hslToHex(hue, saturation, lightness);
  }

  private hslToHex(h: number, s: number, l: number): string {
    const normalizedS = s / 100;
    const normalizedL = l / 100;

    const c = (1 - Math.abs(2 * normalizedL - 1)) * normalizedS;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = normalizedL - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) {
      r = c; g = x; b = 0;
    } else if (h < 120) {
      r = x; g = c; b = 0;
    } else if (h < 180) {
      r = 0; g = c; b = x;
    } else if (h < 240) {
      r = 0; g = x; b = c;
    } else if (h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    const toHex = (value: number) =>
      Math.round((value + m) * 255).toString(16).padStart(2, '0');

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  toggleSummary() {
    this.showSummary.update(v => !v);
  }
}
