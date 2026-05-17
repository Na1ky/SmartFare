import { Injectable } from '@angular/core';
import { Itinerary, ItineraryItem } from '../models/itinerary.model';
import { BuilderPoi } from '../models/builder.types';

export interface CostBreakdown {
    accommodations: { title: string; price: number; days: number; subtotal: number }[];
    activities: { title: string; price: number; quantity: number }[];
    totalAccommodation: number;
    totalActivities: number;
    grandTotal: number;
}

export interface ItineraryExport {
    title: string;
    dates: { start: string; end: string };
    location: string;
    days: DayExport[];
    costs: CostBreakdown;
    generatedAt: string;
}

export interface DayExport {
    day: number;
    groups: DayExportGroup[];
    items: DayExportItem[];
}

export interface DayExportGroup {
    name: string;
    startAt?: string | null;
    endAt?: string | null;
    imageUrl?: string | null;
    items: DayExportItem[];
}

export interface DayExportItem {
    type: 'accommodation' | 'activity';
    title: string;
    subtitle?: string;
    imageUrl?: string;
    notes?: string;
    checkIn?: string;
    checkOut?: string;
    startAt?: string;
    endAt?: string;
    duration?: string;
    groupName?: string | null;
    groupStartAt?: string | null;
    groupEndAt?: string | null;
}

@Injectable({
    providedIn: 'root'
})
export class ItineraryExportService {

    /**
     * Calculates cost breakdown for the itinerary
     */
    calculateCosts(items: ItineraryItem[], pois: Map<string, BuilderPoi>): CostBreakdown {
        const accommodations: any[] = [];
        const activities: any[] = [];
        let totalAccommodation = 0;
        let totalActivities = 0;

        // Group items by type
        const groupedItems = new Map<string, ItineraryItem[]>();
        for (const item of items) {
            const key = item.accommodationId ? `acc-${item.accommodationId}` : `act-${item.activityId}`;
            if (!groupedItems.has(key)) {
                groupedItems.set(key, []);
            }
            groupedItems.get(key)!.push(item);
        }

        // Calculate accommodation costs
        for (const [key, itemGroup] of groupedItems) {
            if (key.startsWith('acc-')) {
                const poiKey = `accommodation-${key.substring(4)}`;
                const poi = pois.get(poiKey);
                if (poi && poi.price) {
                    const days = new Set(itemGroup.map(i => i.dayNumber)).size;
                    const subtotal = poi.price * days;
                    accommodations.push({
                        title: poi.title,
                        price: poi.price,
                        days,
                        subtotal
                    });
                    totalAccommodation += subtotal;
                }
            } else if (key.startsWith('act-')) {
                const poiKey = `activity-${key.substring(4)}`;
                const poi = pois.get(poiKey);
                if (poi && poi.price) {
                    const quantity = itemGroup.length;
                    activities.push({
                        title: poi.title,
                        price: poi.price,
                        quantity
                    });
                    totalActivities += poi.price * quantity;
                }
            }
        }

        return {
            accommodations,
            activities,
            totalAccommodation,
            totalActivities,
            grandTotal: totalAccommodation + totalActivities
        };
    }

    /**
     * Generates a detailed export of the itinerary
     */
    generateExport(
        itinerary: Itinerary,
        items: ItineraryItem[],
        pois: Map<string, BuilderPoi>,
        location?: { name: string }
    ): ItineraryExport {
        const costs = this.calculateCosts(items, pois);
        const sortedItems = [...items].sort((a, b) => {
            if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
            return a.orderInt - b.orderInt;
        });
        const itemsByDay = this.groupByDay(sortedItems);
        const days: DayExport[] = [];

        for (const [dayNum, dayItems] of itemsByDay) {
            const dayGroups = new Map<string, DayExportGroup>();
            const standaloneItems: DayExportItem[] = [];

            const dayExport: DayExport = {
                day: dayNum,
                groups: [],
                items: []
            };

            for (const item of dayItems) {
                const poi = this.getPoiForItem(item, pois);
                if (!poi) continue;

                const isHotel = poi.type === 'accommodation';
                const itemExport: DayExportItem = {
                    type: poi.type,
                    title: poi.title,
                    subtitle: poi.subtitle,
                    imageUrl: poi.imageUrl,
                    notes: item.note?.trim() || undefined,
                    checkIn: isHotel ? this.formatClock(item.plannedStartAt) : undefined,
                    checkOut: isHotel ? this.formatClock(item.plannedEndAt) : undefined,
                    startAt: !isHotel ? this.formatClock(item.plannedStartAt) : undefined,
                    endAt: !isHotel ? this.formatClock(item.plannedEndAt) : undefined,
                    duration: this.calculateDuration(item.plannedStartAt, item.plannedEndAt),
                    groupName: item.groupName || null,
                    groupStartAt: item.groupStartAt || null,
                    groupEndAt: item.groupEndAt || null
                };

                if (itemExport.groupName) {
                    const groupKey = this.buildGroupKey(itemExport.groupName, itemExport.groupStartAt, itemExport.groupEndAt);

                    if (!dayGroups.has(groupKey)) {
                        dayGroups.set(groupKey, {
                            name: itemExport.groupName,
                            startAt: itemExport.groupStartAt || null,
                            endAt: itemExport.groupEndAt || null,
                            imageUrl: itemExport.imageUrl || null,
                            items: []
                        });
                    }

                    const group = dayGroups.get(groupKey)!;
                    if (!group.imageUrl && itemExport.imageUrl) {
                        group.imageUrl = itemExport.imageUrl;
                    }

                    group.items.push(itemExport);
                } else {
                    standaloneItems.push(itemExport);
                }
            }

            dayExport.groups = Array.from(dayGroups.values()).sort((a, b) => {
                const startA = a.startAt || '';
                const startB = b.startAt || '';

                if (startA !== startB) {
                    return startA.localeCompare(startB);
                }

                return a.name.localeCompare(b.name);
            });
            dayExport.items = standaloneItems;

            days.push(dayExport);
        }

        return {
            title: itinerary.name || 'Il mio itinerario',
            dates: {
                start: itinerary.startDate || '',
                end: itinerary.endDate || ''
            },
            location: location?.name || 'Destinazione',
            days,
            costs,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Exports to JSON
     */
    exportToJSON(data: ItineraryExport): string {
        return JSON.stringify(data, null, 2);
    }

    /**
     * Exports to HTML (printable)
     */
    exportToHTML(data: ItineraryExport): string {
        const html = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(data.title)}</title>
    <style>
        /* CSS Reset & Print Settings */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { margin: 15mm; size: A4; }
        
        :root {
            --bg-color: #0b1120;
            --bg-color-alt: #0b0914;
            --glass-bg: rgba(22, 17, 41, 0.7);
            --glass-border: rgba(255, 255, 255, 0.08);
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --accent: #2dd4bf;
            --accent-alt: #38bdf8;
        }

        body {
            font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            line-height: 1.5;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        .export-sheet {
            max-width: 100%;
            margin: 0 auto;
            background: var(--bg-color);
            position: relative;
        }

        /* Hero Section */
        .hero {
            padding: 40px 30px;
            background: linear-gradient(135deg, rgba(11, 9, 20, 0.9), rgba(11, 9, 20, 0.4)), 
                        radial-gradient(circle at top right, rgba(45, 212, 191, 0.15), transparent 40%),
                        radial-gradient(circle at bottom left, rgba(56, 189, 248, 0.15), transparent 40%);
            border-bottom: 1px solid var(--glass-border);
            border-radius: 24px;
            margin-bottom: 30px;
            page-break-after: avoid;
        }

        .eyebrow {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 8px;
            background: rgba(45, 212, 191, 0.1);
            color: var(--accent);
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-bottom: 16px;
        }

        h1 {
            font-size: 38px;
            font-weight: 800;
            line-height: 1.1;
            margin-bottom: 12px;
            background: linear-gradient(to right, #fff, #cbd5e1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .hero-subtitle {
            font-size: 16px;
            color: var(--text-muted);
            margin-bottom: 24px;
        }

        .meta-row {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .meta-pill {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--glass-border);
            font-size: 13px;
            font-weight: 600;
            color: #cbd5e1;
        }

        .meta-pill strong { color: var(--text-main); }

        /* Timeline & Days */
        .content {
            padding: 0 10px;
        }

        .day {
            margin-bottom: 40px;
            page-break-inside: avoid;
        }

        .day-header {
            display: flex;
            align-items: baseline;
            gap: 16px;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .day-header h2 {
            font-size: 24px;
            font-weight: 700;
            color: var(--accent);
        }

        .day-count {
            color: var(--text-muted);
            font-size: 13px;
            font-weight: 600;
        }

        /* Group Blocks */
        .group-block {
            margin-bottom: 20px;
            padding: 16px;
            border-radius: 20px;
            background: linear-gradient(145deg, rgba(22, 17, 41, 0.6), rgba(11, 9, 20, 0.8));
            border: 1px solid rgba(45, 212, 191, 0.15);
            page-break-inside: avoid;
        }

        .group-block__head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
        }

        .group-block__title {
            font-size: 18px;
            font-weight: 800;
            color: #fff;
        }

        .group-block__meta {
            margin-top: 4px;
            color: var(--accent-alt);
            font-size: 13px;
            font-weight: 600;
        }

        /* Items */
        .group-item-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .item {
            display: flex;
            gap: 16px;
            padding: 16px;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--glass-border);
            page-break-inside: avoid;
            margin-bottom: 12px;
        }
        
        /* Modifica specifica per le item dentro un gruppo per non avere il bottom margin extra */
        .group-item-list .item {
            margin-bottom: 0;
            background: rgba(11, 9, 20, 0.4);
        }

        .item-media {
            flex-shrink: 0;
            width: 140px;
            height: 110px;
            border-radius: 12px;
            overflow: hidden;
            background: #161129;
            position: relative;
        }

        .item-media img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .item-body {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .item-kicker {
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.06);
            color: var(--text-muted);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-bottom: 6px;
            align-self: flex-start;
        }

        .item-title {
            font-size: 18px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 4px;
        }

        .item-subtitle {
            font-size: 13px;
            color: var(--text-muted);
            margin-bottom: 12px;
        }

        .item-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: auto;
        }

        .detail-card {
            padding: 6px 10px;
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.04);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .detail-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-muted);
        }

        .detail-value {
            font-size: 12px;
            font-weight: 700;
            color: var(--accent);
        }

        .item-notes {
            margin-top: 12px;
            padding: 10px 12px;
            border-left: 3px solid var(--accent-alt);
            background: rgba(56, 189, 248, 0.05);
            border-radius: 0 8px 8px 0;
            color: #cbd5e1;
            font-size: 12px;
            white-space: pre-wrap;
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--glass-border);
            color: var(--text-muted);
            font-size: 12px;
            text-align: center;
        }

        /* Print Specific Adjustments */
        @media print {
            body { font-size: 12pt; }
            .hero { margin-bottom: 20px; }
            .day { margin-bottom: 20px; }
        }
    </style>
</head>
<body>
    <div class="export-sheet">
        <section class="hero">
            <div class="eyebrow">SmartFare Journey Studio</div>
            <h1>${this.escapeHtml(data.title)}</h1>
            <p class="hero-subtitle">Il tuo itinerario dettagliato per ${this.escapeHtml(data.location)}</p>
            <div class="meta-row">
                <div class="meta-pill">📍 <strong>${this.escapeHtml(data.location)}</strong></div>
                <div class="meta-pill">📅 <strong>${this.escapeHtml(data.dates.start)}</strong> — <strong>${this.escapeHtml(data.dates.end)}</strong></div>
            </div>
        </section>

        <section class="content">
            ${data.days.map(day => `
            <div class="day">
                <div class="day-header">
                    <h2>Giorno ${day.day}</h2>
                    <span class="day-count">${day.groups.reduce((count, group) => count + group.items.length, 0) + day.items.length} tappe</span>
                </div>

                ${day.groups.map(group => `
                <section class="group-block">
                    <div class="group-block__head">
                        <div>
                            <div class="group-block__title">${this.escapeHtml(group.name)}</div>
                            <div class="group-block__meta">${this.escapeHtml(this.formatGroupSchedule(group.startAt, group.endAt) || 'Orario da definire')}</div>
                        </div>
                    </div>

                    <div class="group-item-list">
                        ${group.items.map(item => `
                        <article class="item">
                            ${item.imageUrl ? `
                            <div class="item-media">
                                <img src="${this.escapeHtml(item.imageUrl)}" alt="${this.escapeHtml(item.title)}" crossorigin="anonymous">
                            </div>
                            ` : ''}

                            <div class="item-body">
                                <span class="item-kicker">${item.type === 'accommodation' ? 'Hotel / Alloggio' : 'Attività / Tappa'}</span>
                                <div class="item-title">${this.escapeHtml(item.title)}</div>
                                ${item.subtitle ? `<div class="item-subtitle">${this.escapeHtml(item.subtitle)}</div>` : ''}

                                <div class="item-grid">
                                    ${item.checkIn ? `
                                    <div class="detail-card">
                                        <span class="detail-label">Check-in:</span>
                                        <span class="detail-value">${this.escapeHtml(item.checkIn)}</span>
                                    </div>
                                    ` : ''}
                                    ${item.checkOut ? `
                                    <div class="detail-card">
                                        <span class="detail-label">Check-out:</span>
                                        <span class="detail-value">${this.escapeHtml(item.checkOut)}</span>
                                    </div>
                                    ` : ''}
                                    ${item.startAt ? `
                                    <div class="detail-card">
                                        <span class="detail-label">Arrivo:</span>
                                        <span class="detail-value">${this.escapeHtml(item.startAt)}</span>
                                    </div>
                                    ` : ''}
                                    ${item.endAt ? `
                                    <div class="detail-card">
                                        <span class="detail-label">Partenza:</span>
                                        <span class="detail-value">${this.escapeHtml(item.endAt)}</span>
                                    </div>
                                    ` : ''}
                                    ${item.duration ? `
                                    <div class="detail-card">
                                        <span class="detail-label">Durata:</span>
                                        <span class="detail-value">${this.escapeHtml(item.duration)}</span>
                                    </div>
                                    ` : ''}
                                </div>
                                
                                ${item.notes ? `
                                <div class="item-notes">
                                    ${this.escapeHtml(item.notes)}
                                </div>
                                ` : ''}
                            </div>
                        </article>
                        `).join('')}
                    </div>
                </section>
                `).join('')}

                ${day.items.map(item => `
                <article class="item">
                    ${item.imageUrl ? `
                    <div class="item-media">
                        <img src="${this.escapeHtml(item.imageUrl)}" alt="${this.escapeHtml(item.title)}" crossorigin="anonymous">
                    </div>
                    ` : ''}

                    <div class="item-body">
                        <span class="item-kicker">${item.type === 'accommodation' ? 'Hotel / Alloggio' : 'Attività / Tappa'}</span>
                        <div class="item-title">${this.escapeHtml(item.title)}</div>
                        ${item.subtitle ? `<div class="item-subtitle">${this.escapeHtml(item.subtitle)}</div>` : ''}

                        <div class="item-grid">
                            ${item.checkIn ? `
                            <div class="detail-card">
                                <span class="detail-label">Check-in:</span>
                                <span class="detail-value">${this.escapeHtml(item.checkIn)}</span>
                            </div>
                            ` : ''}
                            ${item.checkOut ? `
                            <div class="detail-card">
                                <span class="detail-label">Check-out:</span>
                                <span class="detail-value">${this.escapeHtml(item.checkOut)}</span>
                            </div>
                            ` : ''}
                            ${item.startAt ? `
                            <div class="detail-card">
                                <span class="detail-label">Arrivo:</span>
                                <span class="detail-value">${this.escapeHtml(item.startAt)}</span>
                            </div>
                            ` : ''}
                            ${item.endAt ? `
                            <div class="detail-card">
                                <span class="detail-label">Partenza:</span>
                                <span class="detail-value">${this.escapeHtml(item.endAt)}</span>
                            </div>
                            ` : ''}
                            ${item.duration ? `
                            <div class="detail-card">
                                <span class="detail-label">Durata:</span>
                                <span class="detail-value">${this.escapeHtml(item.duration)}</span>
                            </div>
                            ` : ''}
                        </div>

                        ${item.notes ? `
                        <div class="item-notes">
                            ${this.escapeHtml(item.notes)}
                        </div>
                        ` : ''}
                    </div>
                </article>
                `).join('')}
            </div>
            `).join('')}

            <div class="footer">
                Generato da SmartFare Journey Studio il ${new Date(data.generatedAt).toLocaleString('it-IT')}
            </div>
        </section>
    </div>
</body>
</html>
        `;
        return html;
    }

    /**
     * Downloads a file
     */
    downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    private groupByDay(items: ItineraryItem[]): Map<number, ItineraryItem[]> {
        const grouped = new Map<number, ItineraryItem[]>();
        for (const item of items) {
            const day = item.dayNumber || 1;
            if (!grouped.has(day)) {
                grouped.set(day, []);
            }
            grouped.get(day)!.push(item);
        }
        return grouped;
    }

    private buildGroupKey(name: string, startAt?: string | null, endAt?: string | null): string {
        return `${name.toLowerCase()}:${startAt || ''}:${endAt || ''}`;
    }

    formatGroupSchedule(startAt?: string | null, endAt?: string | null): string | null {
        const start = this.formatClock(startAt);
        const end = this.formatClock(endAt);

        if (start && end) return `${start} - ${end}`;
        if (start) return `Dalle ${start}`;
        if (end) return `Fino alle ${end}`;
        return null;
    }

    private getPoiForItem(item: ItineraryItem, pois: Map<string, BuilderPoi>): BuilderPoi | undefined {
        if (item.accommodationId) {
            return pois.get(`accommodation-${item.accommodationId}`);
        } else if (item.activityId) {
            return pois.get(`activity-${item.activityId}`);
        }
        return undefined;
    }

    private calculateDuration(start?: string | null, end?: string | null): string | undefined {
        if (!start || !end) return undefined;
        const startMin = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1]);
        const endMin = parseInt(end.split(':')[0]) * 60 + parseInt(end.split(':')[1]);
        const duration = endMin - startMin;
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    private formatClock(value?: string | null): string | undefined {
        if (!value) return undefined;
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        return trimmed;
    }

    private escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}
