import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Itinerary, ItineraryWorkspace } from '../../../../core/models/itinerary.model';
import { VoyagerChatService, ChatMode, ChatSession } from '../../../../core/services/voyager-chat.service';
import { AlertService } from '../../../../core/services/alert.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-builder-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './builder-chat.component.html',
  styleUrl: './builder-chat.component.css'
})
export class BuilderChatComponent implements OnChanges, AfterViewChecked {
  @Input() workspace: ItineraryWorkspace | null = null;
  @Input() itinerary: Itinerary | null = null;

  protected readonly chatService = inject(VoyagerChatService);
  private readonly alertService = inject(AlertService);

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  draftMessage = '';

  get hasContext(): boolean {
    return !!this.workspace?.location?.id;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['itinerary'] && this.itinerary?.chatSessionId) {
      this.loadLinkedSession(this.itinerary.chatSessionId);
    } else if (changes['workspace'] && this.hasContext && !this.chatService.activeSession()) {
      // Default behavior if no session is linked yet
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

  async toggleMode(mode: ChatMode) {
    if (this.chatService.mode() === mode) return;

    const active = this.chatService.activeSession();
    if (active) {
      this.chatService.updateSession(active.id, { mode }).subscribe(() => {
        this.chatService.mode.set(mode);
      });
    } else {
      this.chatService.mode.set(mode);
    }
  }

  async sendMessage() {
    if (!this.draftMessage.trim() || this.chatService.isStreaming()) return;

    const content = this.draftMessage.trim();
    this.draftMessage = '';

    let active = this.chatService.activeSession();
    if (!active) {
      active = await firstValueFrom(
        this.chatService.createSession({
          mode: this.chatService.mode(),
          locationId: this.workspace?.location?.id,
          title: `Chat Builder - ${this.workspace?.location?.name || 'Nuova'}`
        })
      ).catch(err => {
        this.alertService.error('Errore creazione sessione');
        throw err;
      });
    }

    await this.chatService.sendMessageStreaming(active.id, content, () => {}).catch(err => {
      this.alertService.error('Errore invio messaggio');
    });
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
}
