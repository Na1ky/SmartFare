import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Itinerary } from '../models/itinerary.model';
import { AuthService } from '../auth/auth.service';

export type ChatMode = 'planner' | 'assistant';

export interface PlannerState {
  destination: string | null;
  locationId: number | null;
  days: number | null;
  travelType: string | null;
  travelers: string | null;
  interests: string[];
  pace: string | null;
  style: string | null;
  period: string | null;
  departureAirport: string | null;
  preferredTransport: string | null;
  hotelStyle: string | null;
}

export interface ChatSession {
  id: number;
  title: string | null;
  mode: ChatMode;
  isPinned: boolean;
  isActive?: boolean;
  locationId?: number | null;
  metadata?: {
    plannerState?: PlannerState;
    readyToGenerate?: boolean;
    generatedItinerary?: Itinerary;
  } | null;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  isStreaming?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VoyagerChatService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/api/chat`;

  readonly sessions = signal<ChatSession[]>([]);
  readonly activeSession = signal<ChatSession | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly isSidebarOpen = signal(true);
  readonly isStreaming = signal(false);
  readonly isLoadingSessions = signal(false);
  readonly isLoadingMessages = signal(false);
  readonly mode = signal<ChatMode>('planner');
  readonly plannerState = signal<PlannerState | null>(null);
  readonly readyToGenerate = signal(false);

  loadSessions(): Observable<ChatSession[]> {
    this.isLoadingSessions.set(true);
    return this.http.get<ChatSession[]>(`${this.apiUrl}/sessions`).pipe(
      tap({
        next: (sessions) => {
          this.sessions.set(sessions);
          this.isLoadingSessions.set(false);
        },
        error: () => {
          this.isLoadingSessions.set(false);
        }
      })
    );
  }

  createSession(data: { title?: string; mode?: ChatMode; locationId?: number | null }): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.apiUrl}/sessions`, data).pipe(
      tap((session) => {
        this.activeSession.set(session);
        this.mode.set(session.mode);
        this.plannerState.set(session.metadata?.plannerState || null);
        this.readyToGenerate.set(Boolean(session.metadata?.readyToGenerate));
        this.messages.set([]);
        this.upsertSession(session);
      })
    );
  }

  getSessionMessages(sessionId: number): Observable<ChatMessage[]> {
    this.isLoadingMessages.set(true);
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/sessions/${sessionId}/messages`).pipe(
      tap({
        next: (messages) => {
          this.messages.set(messages);
          this.isLoadingMessages.set(false);
        },
        error: () => {
          this.isLoadingMessages.set(false);
        }
      })
    );
  }

  updateSession(sessionId: number, data: Partial<ChatSession>): Observable<any> {
    return this.http.patch(`${this.apiUrl}/sessions/${sessionId}`, data).pipe(
      tap(() => {
        const active = this.activeSession();
        if (active && active.id === sessionId) {
          const updated = { ...active, ...data };
          this.activeSession.set(updated);
          if (data.mode) this.mode.set(data.mode);
        }

        this.sessions.update((sessions) =>
          sessions.map((session) => (session.id === sessionId ? { ...session, ...data } : session))
        );
      })
    );
  }

  deleteSession(sessionId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/sessions/${sessionId}`).pipe(
      tap(() => {
        this.sessions.update((sessions) => sessions.filter((session) => session.id !== sessionId));
      })
    );
  }

  generateItinerary(sessionId: number): Observable<{ success: boolean; itinerary: Itinerary }> {
    return this.http.post<{ success: boolean; itinerary: Itinerary }>(
      `${this.apiUrl}/sessions/${sessionId}/generate-itinerary`,
      {}
    );
  }

  async sendMessageStreaming(sessionId: number, message: string, onDone: (chunk: any) => void) {
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      createdAt: new Date().toISOString()
    };

    this.messages.update((messages) => [...messages, userMessage, { role: 'assistant', content: '', isStreaming: true }]);
    this.isStreaming.set(true);

    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Sessione non autenticata');
    }

    let buffer = '';
    let fullContent = '';

    try {
      const response = await fetch(`${this.apiUrl}/sessions/${sessionId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Streaming failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          const eventLine = rawEvent
            .split('\n')
            .find((line) => line.startsWith('data: '));

          if (!eventLine) continue;

          const data = JSON.parse(eventLine.slice(6));
          if (data.reply) {
            fullContent += data.reply;
            this.updateLastAssistantMessage(fullContent);
          }

          if (data.done) {
            this.finalizeLastAssistantMessage(fullContent);
            this.applyStreamMetadata(sessionId, data.metadata);
            onDone(data);
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      this.updateLastAssistantMessage('Si è verificato un errore nella comunicazione con Voyager AI.');
      this.finalizeLastAssistantMessage('Si è verificato un errore nella comunicazione con Voyager AI.');
    } finally {
      this.isStreaming.set(false);
    }
  }

  setActiveSession(session: ChatSession | null) {
    this.activeSession.set(session);
    this.mode.set(session?.mode || 'planner');
    this.plannerState.set(session?.metadata?.plannerState || null);
    this.readyToGenerate.set(Boolean(session?.metadata?.readyToGenerate));
  }

  clearActiveConversation(mode?: ChatMode) {
    this.activeSession.set(null);
    this.messages.set([]);
    this.mode.set(mode || this.mode());
    this.plannerState.set(null);
    this.readyToGenerate.set(false);
  }

  private updateLastAssistantMessage(content: string) {
    this.messages.update((messages) => {
      const copy = [...messages];
      const index = copy.length - 1;
      if (index >= 0 && copy[index].role === 'assistant') {
        copy[index] = { ...copy[index], content };
      }
      return copy;
    });
  }

  private finalizeLastAssistantMessage(content: string) {
    this.messages.update((messages) => {
      const copy = [...messages];
      const index = copy.length - 1;
      if (index >= 0 && copy[index].role === 'assistant') {
        copy[index] = {
          ...copy[index],
          content,
          isStreaming: false,
          createdAt: copy[index].createdAt || new Date().toISOString()
        };
      }
      return copy;
    });
  }

  private applyStreamMetadata(sessionId: number, metadata?: any) {
    if (!metadata) return;

    this.readyToGenerate.set(Boolean(metadata.readyToGenerate));
    this.plannerState.set(metadata.plannerState || null);

    const active = this.activeSession();
    if (!active || active.id !== sessionId) return;

    const updatedSession: ChatSession = {
      ...active,
      title: metadata.suggestedTitle || active.title,
      metadata: {
        ...(active.metadata || {}),
        plannerState: metadata.plannerState || active.metadata?.plannerState,
        readyToGenerate: Boolean(metadata.readyToGenerate)
      },
      lastMessageAt: new Date().toISOString()
    };

    this.activeSession.set(updatedSession);
    this.upsertSession(updatedSession);
  }

  private upsertSession(session: ChatSession) {
    this.sessions.update((sessions) => {
      const existingIndex = sessions.findIndex((entry) => entry.id === session.id);
      if (existingIndex === -1) {
        return [session, ...sessions];
      }

      const copy = [...sessions];
      copy[existingIndex] = { ...copy[existingIndex], ...session };
      return copy;
    });
  }
}
