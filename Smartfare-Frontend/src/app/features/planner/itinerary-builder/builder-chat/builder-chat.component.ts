import { Component, Input, OnChanges, SimpleChanges, inject, signal, ElementRef, ViewChild, AfterViewChecked, Output, EventEmitter, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Itinerary, ItineraryWorkspace } from '../../../../core/models/itinerary.model';
import { VoyagerChatService, ChatSession } from '../../../../core/services/voyager-chat.service';
import { AlertService } from '../../../../core/services/alert.service';
import { Activity } from '../../../../core/models/activity.model';
import { Accommodation } from '../../../../core/models/accommodation.model';
import { firstValueFrom } from 'rxjs';
import { BuilderPoi } from '../../../../core/models/builder.types';

type BuilderSuggestionAction = {
  label: string;
  prompt: string;
};

@Component({
  selector: 'app-builder-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './builder-chat.component.html',
  styleUrls: ['./builder-chat.component.css']
})
export class BuilderChatComponent implements OnChanges, AfterViewChecked {
  @Input() workspace: ItineraryWorkspace | null = null;
  @Input() itinerary: Itinerary | null = null;
  @Output() poiFocused = new EventEmitter<BuilderPoi>();

  protected readonly chatService = inject(VoyagerChatService);
  private readonly alertService = inject(AlertService);

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  draftMessage = '';

  readonly isBusy = computed(() => this.chatService.isLoadingSessions() || this.chatService.isLoadingMessages());

  get suggestedPois(): BuilderPoi[] {
    return this.buildSuggestedPois();
  }

  get suggestedActions(): BuilderSuggestionAction[] {
    return this.buildSuggestedActions();
  }

  get hasContext(): boolean {
    return !!this.workspace?.location?.id;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['itinerary'] && this.itinerary?.chatSessionId) {
      this.loadLinkedSession(this.itinerary.chatSessionId);
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private async loadLinkedSession(sessionId: number) {
    if (this.chatService.activeSession()?.id === sessionId) return;

    this.chatService.loadSessions().subscribe({
      next: (sessions) => {
        const linked = sessions.find(s => s.id === sessionId);
        if (linked) {
          this.chatService.setActiveSession(linked);
          this.chatService.getSessionMessages(sessionId).subscribe();
        }
      }
    });
  }

  async sendMessage() {
    if (!this.draftMessage.trim() || this.chatService.isStreaming()) return;

    const content = this.draftMessage.trim();
    this.draftMessage = '';

    let active = this.chatService.activeSession();
    if (!active) {
      active = await firstValueFrom(
        this.chatService.createSession({
          mode: 'planner',
          locationId: this.workspace?.location?.id,
          title: `Chat Builder - ${this.workspace?.location?.name || 'Nuova'}`
        })
      ).catch(err => {
        this.alertService.error('Errore creazione sessione');
        throw err;
      });
    }

    await this.chatService.sendMessageStreaming(active.id, content, () => { }).catch(err => {
      this.alertService.error('Errore invio messaggio');
    });
  }

  focusPoi(poi: BuilderPoi) {
    this.poiFocused.emit(poi);
  }

  applyAction(action: BuilderSuggestionAction) {
    this.draftMessage = action.prompt;
    void this.sendMessage();
  }

  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) return;
    keyboardEvent.preventDefault();
    this.sendMessage();
  }

  formatMessage(content: string): string {
    if (!content) return '';
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  private scrollToBottom() {
    if (this.scrollContainer) {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    }
  }

  private getConversationText(): string {
    return this.chatService.messages().map((message) => message.content).join(' ');
  }

  private buildSuggestedActions(): BuilderSuggestionAction[] {
    const context = this.getConversationText().toLowerCase();
    const actions: BuilderSuggestionAction[] = [];

    if (context.includes('giorno') || context.includes('tappe') || context.includes('itinerario')) {
      actions.push({
        label: 'Aggiungi un giorno ricco',
        prompt: 'Aggiungi un giorno in più con più tappe, colazione, pausa pranzo e una chiusura serale coerente.'
      });
    }

    if (context.includes('nostalg') || context.includes('lento') || context.includes('rilassat') || context.includes('autentic')) {
      actions.push({
        label: 'Crea un giorno nostalgico',
        prompt: 'Crea un giorno nostalgico con ritmo lento, quartieri autentici, soste panoramiche e momenti tranquilli.'
      });
    }

    if (context.includes('riordina') || context.includes('rorganizz') || context.includes('route') || context.includes('percorso')) {
      actions.push({
        label: 'Riorganizza le tappe',
        prompt: 'Riorganizza le attività in un percorso più fluido, riducendo gli spostamenti inutili.'
      });
    }

    if (context.includes('muse') || context.includes('cultura') || context.includes('arte')) {
      actions.push({
        label: 'Giro museale',
        prompt: 'Propone un giro museale o culturale con tappe reali del workspace e indicami come distribuirle nella giornata.'
      });
    }

    return actions.slice(0, 3);
  }

  private buildSuggestedPois(): BuilderPoi[] {
    const ws = this.workspace;
    if (!ws?.location?.id) return [];

    const context = this.getConversationText().toLowerCase();
    const categories = new Set<string>();

    if (context.includes('muse') || context.includes('cultura') || context.includes('arte') || context.includes('monument')) {
      ['Musei', 'Monumenti', 'Landmark', 'Chiese', 'Castelli', 'Punti panoramici'].forEach((value) => categories.add(value.toLowerCase()));
    }

    if (context.includes('food') || context.includes('ristor') || context.includes('cibo') || context.includes('cena') || context.includes('pranzo')) {
      ['Ristoranti', 'Caffe', 'Panetterie', 'Bar', 'Enoteche', 'Gelaterie'].forEach((value) => categories.add(value.toLowerCase()));
    }

    if (context.includes('notte') || context.includes('night') || context.includes('aperitivo') || context.includes('bar')) {
      ['Bar', 'Enoteche'].forEach((value) => categories.add(value.toLowerCase()));
    }

    if (context.includes('relax') || context.includes('natura') || context.includes('lento') || context.includes('nostalg')) {
      ['Parchi', 'Punti panoramici', 'Mercati'].forEach((value) => categories.add(value.toLowerCase()));
    }

    const activityMatches = ws.activities
      .filter((activity) => {
        const categoryName = (activity.category?.name || '').toLowerCase();
        const name = activity.name.toLowerCase();
        return categories.has(categoryName) || [...categories].some((entry) => name.includes(entry.slice(0, 5)));
      })
      .slice(0, 3)
      .map((activity) => this.toPoi(activity.id, 'activity'));

    if (activityMatches.length > 0) return activityMatches;

    return ws.activities
      .slice(0, 3)
      .map((activity) => this.toPoi(activity.id, 'activity'));
  }

  private toPoi(entityId: number, type: 'activity' | 'accommodation'): BuilderPoi {
    const ws = this.workspace;
    const source = type === 'activity'
      ? ws?.activities.find((item) => item.id === entityId)
      : ws?.accommodations.find((item) => item.id === entityId);

    if (!source) {
      throw new Error('POI suggestion non disponibile');
    }

    const isAccommodation = type === 'accommodation';
    const activity = source as any as Activity;
    const accommodation = source as any as Accommodation;
    return {
      key: `${type}-${source.id}`,
      type,
      entityId: source.id,
      title: source.name,
      subtitle: isAccommodation ? 'Alloggio suggerito' : activity.category?.name || activity.street || 'Attività suggerita',
      latitude: source.latitude,
      longitude: source.longitude,
      categoryId: isAccommodation ? undefined : activity.categoryId,
      categoryName: isAccommodation ? undefined : activity.category?.name,
      itemTypeCode: isAccommodation ? 'ACCOMMODATION' : 'ACTIVITY',
      imageUrl: source.imageUrl,
      rating: isAccommodation ? accommodation.stars : activity.rating,
      price: isAccommodation ? accommodation.pricePerNight : activity.price
    };
  }
}
