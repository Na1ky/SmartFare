import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ChatMode,
  ChatSession,
  VoyagerChatService
} from '../../core/services/voyager-chat.service';
import { AuthService } from '../../core/auth/auth.service';
import { ItineraryService } from '../../core/services/itinerary.service';
import { AlertService } from '../../core/services/alert.service';

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

type SessionGroup = {
  label: string;
  items: ChatSession[];
};

@Component({
  selector: 'app-voyager-ai',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voyager-ai.component.html',
  styleUrls: ['./voyager-ai.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VoyagerAiComponent implements OnInit, AfterViewChecked {
  protected readonly chatService = inject(VoyagerChatService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly itineraryService = inject(ItineraryService);
  private readonly alertService = inject(AlertService);

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  readonly userName = signal('Viaggiatore');
  readonly userAvatar = signal<string | null>(null);
  readonly userInitial = signal('V');
  readonly searchTerm = signal('');
  readonly message = signal('');
  readonly pendingAttachmentName = signal<string | null>(null);
  readonly isGeneratingItinerary = signal(false);
  readonly isVoiceSupported = signal(false);
  readonly isListening = signal(false);
  readonly showMobileSidebar = signal(false);

  private speechRecognition: any = null;
  private lastPromptHandled: string | null = null;

  readonly plannerTemplates = [
    { label: 'Weekend Escape', text: 'Voglio organizzare un weekend escape di 3 giorni con ritmo rilassato e focus food.' },
    { label: 'Honeymoon', text: 'Sto pianificando un honeymoon dal taglio luxury con momenti romantici e cene speciali.' },
    { label: 'Foodie Trip', text: 'Vorrei un foodie trip con mercati locali, signature restaurants e quartieri autentici.' },
    { label: 'Road Adventure', text: 'Cerco un adventure road trip di 5 giorni con natura, tappe panoramiche e ritmo dinamico.' }
  ];

  readonly assistantTemplates = [
    { label: 'Best Restaurants', text: 'Quali sono i migliori quartieri food e ristoranti da non perdere?' },
    { label: 'Free Things', text: 'Cosa posso vedere gratis in città in 2 giorni?' },
    { label: 'Local Culture', text: 'Consigliami musei, mercati e luoghi culturali davvero memorabili.' },
    { label: 'Nightlife', text: 'Quali zone consigli per nightlife elegante e locali interessanti?' }
  ];

  readonly filteredSessions = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.chatService.sessions();

    return this.chatService.sessions().filter((session) =>
      `${session.title || ''} ${session.metadata?.plannerState?.destination || ''}`.toLowerCase().includes(term)
    );
  });

  readonly pinnedSessions = computed(() =>
    this.filteredSessions().filter((session) => session.isPinned)
  );

  readonly recentSessionGroups = computed<SessionGroup[]>(() => {
    const unpinned = this.filteredSessions().filter((session) => !session.isPinned);
    const groups = new Map<string, ChatSession[]>();

    for (const session of unpinned) {
      const label = this.resolveSessionGroupLabel(session.lastMessageAt || session.createdAt);
      groups.set(label, [...(groups.get(label) || []), session]);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({
      label,
      items: items.sort((left, right) => this.toTime(right) - this.toTime(left))
    }));
  });

  readonly quickPrompts = computed(() =>
    this.chatService.mode() === 'planner' ? this.plannerTemplates : this.assistantTemplates
  );

  readonly plannerHighlights = computed(() => {
    const state = this.chatService.plannerState();
    if (!state) return [];

    return [
      state.destination ? `Destinazione: ${state.destination}` : null,
      state.days ? `${state.days} giorni` : null,
      state.travelers ? `Viaggiatori: ${state.travelers}` : null,
      state.interests?.length ? `Interessi: ${state.interests.join(', ')}` : null,
      state.pace ? `Ritmo: ${state.pace}` : null,
      (state.style || state.hotelStyle) ? `Stile: ${state.style || state.hotelStyle}` : null
    ].filter((item): item is string => Boolean(item));
  });

  ngOnInit() {
    this.loadUserData();
    this.setupVoiceInput();

    this.chatService.loadSessions().subscribe({
      next: (sessions) => {
        const requestedSessionId = Number(this.route.snapshot.queryParams['sessionId']);
        const initialPrompt = this.route.snapshot.queryParams['prompt'];

        if (requestedSessionId) {
          const existing = sessions.find((session) => session.id === requestedSessionId);
          if (existing) {
            this.selectSession(existing);
            return;
          }
        }

        if (initialPrompt && this.lastPromptHandled !== initialPrompt) {
          this.lastPromptHandled = initialPrompt;
          this.startNewChatWithPrompt(initialPrompt);
          return;
        }

        this.enterCleanLandingState();
      }
    });
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private loadUserData() {
    const data = this.authService.getUserData() as any;
    if (!data) return;

    this.userName.set(data.name || data.email || 'Viaggiatore');
    this.userAvatar.set(data.avatarUrl || null);
    this.userInitial.set((data.name || data.email || 'V').charAt(0).toUpperCase());
  }

  toggleSidebar() {
    this.chatService.isSidebarOpen.update((value) => !value);
  }

  toggleMobileSidebar() {
    this.showMobileSidebar.update((value) => !value);
  }

  goHome() {
    this.showMobileSidebar.set(false);
    this.router.navigate(['/home']);
  }

  async createNewChat(mode: ChatMode = this.chatService.mode()) {
    const active = this.chatService.activeSession();
    const hasNoMessages = this.chatService.messages().length === 0;
    const hasDraftInput = !this.message().trim() && !this.pendingAttachmentName();

    if (active && hasNoMessages && hasDraftInput) {
      if (active.mode !== mode) {
        this.chatService.updateSession(active.id, { mode }).subscribe(() => {
          this.chatService.setActiveSession({ ...active, mode });
        });
      }

      this.showMobileSidebar.set(false);
      this.router.navigate([], { queryParams: { sessionId: active.id }, queryParamsHandling: 'merge' });
      return;
    }

    const session = await firstValueFrom(
      this.chatService.createSession({
        mode,
        title: mode === 'planner' ? 'Nuova sessione Planner' : 'Nuova sessione Assistant'
      })
    );

    this.chatService.setActiveSession(session);
    this.showMobileSidebar.set(false);
    this.router.navigate([], { queryParams: { sessionId: session.id }, queryParamsHandling: 'merge' });
  }

  startFreshPlanner() {
    this.enterCleanLandingState('planner');
  }

  startFreshAssistant() {
    this.enterCleanLandingState('assistant');
  }

  selectSession(session: ChatSession) {
    this.chatService.setActiveSession(session);
    this.showMobileSidebar.set(false);
    this.chatService.getSessionMessages(session.id).subscribe();
    this.router.navigate([], { queryParams: { sessionId: session.id }, queryParamsHandling: 'merge' });
  }

  togglePin(event: Event, session: ChatSession) {
    event.stopPropagation();
    this.chatService.updateSession(session.id, { isPinned: !session.isPinned }).subscribe();
  }

  deleteSession(event: Event, session: ChatSession) {
    event.stopPropagation();
    if (!confirm('Vuoi eliminare questa conversazione?')) return;

    this.chatService.deleteSession(session.id).subscribe(() => {
      if (this.chatService.activeSession()?.id === session.id) {
        this.chatService.clearActiveConversation(this.chatService.mode());
      }
    });
  }

  onSearch(term: string) {
    this.searchTerm.set(term);
  }

  async toggleMode(mode: ChatMode) {
    if (this.chatService.mode() === mode) return;

    const active = this.chatService.activeSession();
    if (!active) {
      this.enterCleanLandingState(mode);
      return;
    }

    this.chatService.updateSession(active.id, { mode }).subscribe(() => {
      this.chatService.mode.set(mode);
      this.chatService.setActiveSession({ ...active, mode });
    });
  }

  async sendMessage() {
    if (!this.message().trim() || this.chatService.isStreaming()) return;

    const content = this.message().trim();
    this.message.set('');

    let active = this.chatService.activeSession();
    if (!active) {
      active = await firstValueFrom(
        this.chatService.createSession({
          mode: this.chatService.mode(),
          title: this.chatService.mode() === 'planner' ? 'Nuova sessione Planner' : 'Nuova sessione Assistant'
        })
      );
    }

    await this.chatService.sendMessageStreaming(active.id, content, (data) => {
      if (data.metadata?.suggestedTitle) {
        this.router.navigate([], { queryParams: { sessionId: active!.id }, queryParamsHandling: 'merge' });
      }
    });
  }

  async usePrompt(prompt: string) {
    this.message.set(prompt);
    await this.sendMessage();
  }

  async startNewChatWithPrompt(prompt: string) {
    const session = await firstValueFrom(
      this.chatService.createSession({
        title: 'Voyager AI',
        mode: 'planner'
      })
    );

    this.chatService.setActiveSession(session);
    this.router.navigate([], {
      queryParams: { sessionId: session.id },
      queryParamsHandling: 'merge'
    });

    await this.chatService.sendMessageStreaming(session.id, prompt, () => {});
  }

  async generateItinerary() {
    const session = this.chatService.activeSession();
    if (!session) return;

    this.isGeneratingItinerary.set(true);

    try {
      const response = await firstValueFrom(this.chatService.generateItinerary(session.id));
      this.itineraryService.setCurrentItinerary(response.itinerary, { autosave: false });
      await this.router.navigate(['/itineraries/builder']);
    } catch (error: any) {
      const message = error?.error?.message || 'Non sono riuscito a generare l’itinerario.';
      this.alertService.error(message);
    } finally {
      this.isGeneratingItinerary.set(false);
    }
  }

  exportConversation(format: 'md' | 'json') {
    const session = this.chatService.activeSession();
    if (!session) return;

    const payload =
      format === 'json'
        ? JSON.stringify(
            {
              session,
              messages: this.chatService.messages()
            },
            null,
            2
          )
        : this.chatService.messages()
            .map((message) => `## ${message.role === 'user' ? 'You' : 'Voyager AI'}\n\n${message.content}`)
            .join('\n\n');

    const blob = new Blob([payload], {
      type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(session.title || 'voyager-chat').replace(/\s+/g, '-').toLowerCase()}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async shareConversation() {
    const session = this.chatService.activeSession();
    if (!session) return;

    const shareUrl = `${window.location.origin}/voyager?sessionId=${session.id}`;

    if (navigator.share) {
      await navigator.share({
        title: session.title || 'Voyager AI',
        text: 'Ti condivido questa conversazione di viaggio SmartFare.',
        url: shareUrl
      });
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    this.alertService.success('Link conversazione copiato negli appunti.');
  }

  attachPlaceholder(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.pendingAttachmentName.set(file?.name || null);
  }

  clearAttachment() {
    this.pendingAttachmentName.set(null);
  }

  onEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) return;
    event.preventDefault();
    this.sendMessage();
  }

  formatMessage(content: string): string {
    if (!content) return '';

    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  private scrollToBottom() {
    if (!this.scrollContainer) return;
    this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
  }

  private enterCleanLandingState(mode: ChatMode = this.chatService.mode()) {
    this.chatService.clearActiveConversation(mode);
    this.message.set('');
    this.pendingAttachmentName.set(null);
    this.router.navigate([], {
      queryParams: {
        sessionId: null,
        prompt: null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private resolveSessionGroupLabel(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (this.isSameDay(date, today)) return 'Oggi';
    if (this.isSameDay(date, yesterday)) return 'Ieri';

    const diffInDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays <= 7) return 'Questa settimana';
    return 'Meno recenti';
  }

  private isSameDay(left: Date, right: Date): boolean {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }

  private toTime(session: ChatSession): number {
    return new Date(session.lastMessageAt || session.createdAt).getTime();
  }

  private setupVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.isVoiceSupported.set(Boolean(SpeechRecognition));

    if (!SpeechRecognition) return;

    this.speechRecognition = new SpeechRecognition();
    this.speechRecognition.lang = 'it-IT';
    this.speechRecognition.interimResults = true;
    this.speechRecognition.continuous = false;

    this.speechRecognition.onstart = () => this.isListening.set(true);
    this.speechRecognition.onend = () => this.isListening.set(false);
    this.speechRecognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript || '')
        .join(' ');

      this.message.set(transcript.trim());
    };
  }

  toggleVoiceInput() {
    if (!this.speechRecognition) return;

    if (this.isListening()) {
      this.speechRecognition.stop();
      return;
    }

    this.speechRecognition.start();
  }
}
