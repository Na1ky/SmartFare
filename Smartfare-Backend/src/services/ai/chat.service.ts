import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../../config/prisma';
import { AppError } from '../../middleware/error.middleware';
import { GeminiItineraryChatService } from './gemini.service';
import { ChatMode, ChatStreamResponse, PlannerState } from '../../models/chat.model';
import { ItineraryService } from '../itinerary/itinerary.service';

type DbMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
};

type SessionWithMessages = Awaited<ReturnType<ChatService['getSessionOrThrow']>>;

const DEFAULT_TITLE = 'Nuova conversazione';

type ChatHintSuggestion = {
  title: string;
  description?: string;
  type: 'poi' | 'day' | 'food' | 'evening' | 'route' | 'general';
  poiId?: number | null;
  poiType?: 'activity' | 'accommodation' | null;
};

type ChatHintAction = {
  type:
  | 'add_day'
  | 'create_nostalgic_day'
  | 'reorder_route'
  | 'optimize_route'
  | 'add_stop'
  | 'remove_stop'
  | 'focus_poi'
  | 'generate_itinerary';
  label: string;
  payload?: Record<string, unknown>;
};

export class ChatService {
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly modelName = this.resolveModelName(process.env.GEMINI_MODEL);
  private readonly modelFallbacks = this.getModelFallbacks(process.env.GEMINI_MODEL);
  private readonly geminiPlannerService = new GeminiItineraryChatService();
  private readonly itineraryService = new ItineraryService();

  private resolveModelName(rawModelName?: string): string {
    const deprecatedModelMap: Record<string, string> = {
      'gemini-1.5-flash': 'gemini-2.5-flash',
      'gemini-1.5-flash-latest': 'gemini-2.5-flash',
      'gemini-1.5-pro': 'gemini-2.5-flash'
    };
    const fallbackModels = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    const candidates = [
      ...(rawModelName || '')
        .split(',')
        .map((model) => deprecatedModelMap[model.trim()] || model.trim())
        .filter(Boolean),
      ...fallbackModels
    ];

    const validModel = candidates.find((model) => /^gemini-[a-z0-9.-]+$/i.test(model));
    return validModel || 'gemini-2.0-flash';
  }

  private getModelFallbacks(rawModelName?: string): string[] {
    const primary = this.resolveModelName(rawModelName);
    const fallbackModels = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    return [primary, ...fallbackModels].filter((model, index, array) => array.indexOf(model) === index);
  }

  async streamChatResponse(
    userId: number,
    chatId: number,
    userMessage: string,
    onChunk: (chunk: ChatStreamResponse) => void
  ): Promise<void> {
    if (!this.apiKey) {
      throw new AppError('GEMINI_API_KEY mancante', 500);
    }

    const session = await this.getSessionOrThrow(userId, chatId);
    const sessionMetadata = this.asMetadata(session.metadata);
    const persistedMessages = this.toDbMessages(session.messages);

    await prisma.chatMessage.create({
      data: {
        chatId,
        role: 'user',
        content: userMessage
      }
    });

    const baseState = this.normalizePlannerState(sessionMetadata.plannerState);
    const transcript = this.buildTranscript(persistedMessages, userMessage);
    const extractedState = await this.extractPlannerState(session.mode as ChatMode, transcript, baseState);
    const bestLocation = await this.findBestLocation(extractedState.destination || userMessage);
    const plannerState = this.mergePlannerState(baseState, extractedState, bestLocation);

    const history = persistedMessages
      .slice(-16)
      .map((message) => ({
        role: message.role === 'user' ? 'user' : 'model',
        parts: [{ text: message.content }]
      }));

    let fullReply = '';

    try {
      let lastError: unknown = null;

      for (const modelName of this.modelFallbacks) {
        const ai = new GoogleGenerativeAI(this.apiKey);
        const model = ai.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: session.mode === 'planner' ? 0.75 : 0.6,
            topP: 0.85,
            topK: 40
          },
          systemInstruction: {
            role: 'system',
            parts: [{ text: this.getSystemInstruction(session.mode as ChatMode, plannerState, Boolean(bestLocation)) }]
          }
        });

        const chat = model.startChat({
          history: history as any
        });

        fullReply = '';

        try {
          const result = await chat.sendMessageStream(userMessage);

          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (!chunkText) continue;

            fullReply += chunkText;
            onChunk({
              reply: chunkText,
              done: false
            });
          }

          lastError = null;
          break;
        } catch (error) {
          lastError = error;

          const status = Number((error as any)?.status || (error as any)?.statusCode || 0);
          if (status !== 429 || fullReply.length > 0) {
            throw error;
          }

          console.warn(`Gemini stream rate limited on ${modelName}, retrying with fallback model...`);
        }
      }

      if (lastError) {
        throw lastError;
      }

      const finalState = await this.finalizePlannerState(session.mode as ChatMode, plannerState, [
        ...persistedMessages,
        { role: 'user', content: userMessage, createdAt: new Date() },
        { role: 'assistant', content: fullReply, createdAt: new Date() }
      ]);

      const hintWorkspace = finalState.locationId
        ? await this.itineraryService.getWorkspaceData(finalState.locationId, userId)
        : null;
      const chatHints = this.buildChatHints(
        session.mode as ChatMode,
        finalState,
        transcript,
        fullReply,
        hintWorkspace
      );

      const readyToGenerate = this.isReadyToGenerate(session.mode as ChatMode, finalState);
      const suggestedTitle = await this.suggestTitle(
        session.title,
        session.mode as ChatMode,
        finalState,
        userMessage,
        fullReply,
        persistedMessages.length === 0
      );

      await prisma.chatMessage.create({
        data: {
          chatId,
          role: 'assistant',
          content: fullReply
        }
      });

      const mergedMetadata = {
        ...sessionMetadata,
        plannerState: finalState,
        readyToGenerate,
        suggestions: chatHints.suggestions,
        actions: chatHints.actions,
        lastUserPrompt: userMessage,
        lastAssistantReply: fullReply
      };

      await prisma.chatSession.update({
        where: { id: chatId },
        data: {
          title: suggestedTitle,
          locationId: finalState.locationId ?? session.locationId,
          lastMessageAt: new Date(),
          metadata: this.toJsonValue(mergedMetadata)
        }
      });

      onChunk({
        reply: '',
        done: true,
        metadata: {
          plannerState: finalState,
          readyToGenerate,
          suggestedTitle,
          suggestions: chatHints.suggestions,
          actions: chatHints.actions
        }
      });
    } catch (error) {
      console.error('Gemini Stream Error:', error);
      throw this.mapGeminiStreamError(error);
    }
  }

  async generateItineraryFromSession(userId: number, chatId: number) {
    const session = await this.getSessionOrThrow(userId, chatId);
    const sessionMetadata = this.asMetadata(session.metadata);
    const plannerState = this.normalizePlannerState(sessionMetadata.plannerState);

    if (session.mode !== 'planner') {
      throw new AppError('La generazione itinerario è disponibile solo in Planner Mode', 400);
    }

    if (!this.isReadyToGenerate('planner', plannerState)) {
      throw new AppError('La chat non ha ancora raccolto abbastanza dettagli per creare l’itinerario.', 400);
    }

    if (!plannerState.locationId) {
      throw new AppError('Destinazione non ancora collegata a una location supportata dal builder.', 400);
    }
    // Idempotency: if an itinerary has already been generated for this session, return it
    if (sessionMetadata.generatedItinerary && (sessionMetadata.generatedItinerary as any).id) {
      return sessionMetadata.generatedItinerary;
    }
    const workspace = await this.itineraryService.getWorkspaceData(plannerState.locationId, userId);
    if (!workspace.location) {
      throw new AppError('Workspace destinazione non disponibile.', 404);
    }

    const generationPrompt = this.buildItineraryPrompt(plannerState, this.toDbMessages(session.messages));
    const generated = await this.geminiPlannerService.generateInitialItinerary(generationPrompt, {
      location: {
        id: workspace.location.id,
        name: workspace.location.name,
        city: workspace.location.name,
        province: workspace.location.province ?? undefined,
        country: 'Italia'
      },
      itinerary: null,
      accommodations: workspace.accommodations,
      activities: workspace.activities,
      categories: workspace.categories
    });

    if (!generated || !Array.isArray(generated.items) || generated.items.length === 0) {
      throw new AppError('Non sono riuscito a comporre un itinerario coerente. Riprova dalla chat.', 500);
    }

    const startDate = this.buildStartDate(plannerState.period);
    const transcript = this.toDbMessages(session.messages)
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join(' ');
    const enrichedItems = this.buildRichItineraryItems(
      generated.items,
      plannerState,
      workspace,
      startDate,
      transcript
    );

    const itineraryData = {
      name: generated.name || this.suggestItineraryName(plannerState),
      description: generated.description || this.buildItineraryDescription(plannerState),
      startDate: new Date(startDate),
      endDate: new Date(this.buildEndDate(startDate, plannerState.days || 3)),
      locationId: workspace.location.id,
      chatSessionId: chatId,
      userId,
      items: {
        create: enrichedItems.map((item: any) => ({
          dayNumber: item.dayNumber,
          orderInt: item.orderInt,
          itemTypeCode: item.itemTypeCode,
          activityId: item.activityId,
          accommodationId: item.accommodationId,
          note: item.note,
          groupName: item.groupName,
          plannedStartAt: item.plannedStartAt ? new Date(item.plannedStartAt) : null,
          plannedEndAt: item.plannedEndAt ? new Date(item.plannedEndAt) : null
        }))
      }
    };

    const savedItinerary = await prisma.itinerary.create({
      data: itineraryData,
      include: {
        location: true,
        items: {
          include: {
            activity: true,
            accommodation: true
          }
        }
      }
    });

    await prisma.chatSession.update({
      where: { id: chatId },
      data: {
        metadata: this.toJsonValue({
          ...sessionMetadata,
          plannerState,
          readyToGenerate: true,
          generatedItinerary: savedItinerary
        })
      }
    });

    return savedItinerary;
  }

  private async getSessionOrThrow(userId: number, chatId: number) {
    const session = await prisma.chatSession.findFirst({
      where: { id: chatId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!session) {
      throw new AppError('Sessione non trovata', 404);
    }

    return session;
  }

  private getSystemInstruction(mode: ChatMode, plannerState: PlannerState, hasSupportedLocation: boolean): string {
    const base = [
      'Sei Voyager AI, concierge premium di SmartFare.',
      'Rispondi sempre in italiano con tono elegante, chiaro e utile.',
      'Non parlare mai di budget, prezzi, costi o spesa.',
      'Quando citi preferenze usa solo categorie qualitative come ritmo, stile, interessi, atmosfera e tipologia di viaggio.',
      'Evita testi troppo lunghi: 2-4 paragrafi brevi o una lista corta quando serve.'
    ];

    if (mode === 'assistant') {
      return [
        ...base,
        'Sei in Assistant Mode: aiuta con consigli informativi su destinazioni, quartieri, musei, food, nightlife, spiagge, hotel per stile e idee di viaggio.',
        'Non proporre automaticamente la generazione itinerario.',
        'Se l’utente vuole pianificare un viaggio completo, invitalo gentilmente a passare a Planner Mode.'
      ].join('\n');
    }

    const missingFields = this.getMissingPlannerFields(plannerState);
    const supportedLocationNote = hasSupportedLocation
      ? 'La destinazione è supportata dal builder SmartFare.'
      : 'Se la destinazione non è supportata dal builder SmartFare, spiega con tatto che per generare l’itinerario finale serve una destinazione presente nel catalogo.';

    return [
      ...base,
      'Sei in Planner Mode: il tuo obiettivo è raccogliere i dettagli essenziali e preparare un itinerario da inviare al builder.',
      'Raccogli in modo conversazionale: destinazione, giorni, travel type, viaggiatori, interessi, ritmo, stile, periodo, mezzi preferiti, hotel style.',
      'Fai una sola domanda principale per volta, salvo quando mancano solo 1-2 dettagli molto collegati.',
      'Quando hai abbastanza dati, dillo esplicitamente con una frase simile a: "Il tuo itinerario è pronto".',
      'Quando l’utente chiede musei, food, notte, natura o percorsi, proponi tappe reali, concrete e immediatamente utilizzabili.',
      'Se è utile, accompagna la risposta con una piccola azione pratica come aggiungere un giorno, riordinare le tappe o rendere il percorso più nostalgico.',
      'Non inventare disponibilità reali o prezzi.',
      `Stato strutturato corrente: ${JSON.stringify(plannerState)}`,
      `Campi ancora mancanti: ${missingFields.join(', ') || 'nessuno'}`,
      supportedLocationNote
    ].join('\n');
  }

  private buildTranscript(messages: DbMessage[], userMessage: string): string {
    const compactHistory = messages
      .slice(-12)
      .map((message) => `${message.role === 'user' ? 'Utente' : 'Assistant'}: ${message.content}`)
      .join('\n');

    return `${compactHistory}\nUtente: ${userMessage}`.trim();
  }

  private async extractPlannerState(mode: ChatMode, transcript: string, fallback: PlannerState): Promise<Partial<PlannerState>> {
    if (mode !== 'planner' || !this.apiKey) {
      return {};
    }

    const ai = new GoogleGenerativeAI(this.apiKey);
    const model = ai.getGenerativeModel({ model: this.modelName });
    const prompt = [
      'Estrai dati strutturati da questa conversazione di pianificazione viaggio.',
      'Restituisci SOLO JSON valido.',
      'Non inserire budget o prezzi.',
      'Se un dato non è chiaro, usa null o array vuoto.',
      'Schema JSON:',
      '{"destination":null,"days":null,"travelType":null,"travelers":null,"interests":[],"pace":null,"style":null,"period":null,"departureAirport":null,"preferredTransport":null,"hotelStyle":null}',
      `Fallback corrente: ${JSON.stringify(fallback)}`,
      `Conversazione:\n${transcript}`
    ].join('\n');

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return this.safeParseJson(text) || {};
    } catch {
      return {};
    }
  }

  private async finalizePlannerState(
    mode: ChatMode,
    currentState: PlannerState,
    messages: DbMessage[]
  ): Promise<PlannerState> {
    if (mode !== 'planner') {
      return currentState;
    }

    const transcript = messages
      .slice(-16)
      .map((message) => `${message.role === 'user' ? 'Utente' : 'Assistant'}: ${message.content}`)
      .join('\n');

    const extracted = await this.extractPlannerState(mode, transcript, currentState);
    const location = await this.findBestLocation(extracted.destination || currentState.destination || '');
    return this.mergePlannerState(currentState, extracted, location);
  }

  private mergePlannerState(
    baseState: PlannerState,
    nextState: Partial<PlannerState>,
    matchedLocation?: { id: number; name: string } | null
  ): PlannerState {
    const interests = Array.from(
      new Set([...(baseState.interests || []), ...((nextState.interests as string[] | undefined) || [])].filter(Boolean))
    );

    return {
      destination: nextState.destination || baseState.destination || matchedLocation?.name || null,
      locationId: matchedLocation?.id || nextState.locationId || baseState.locationId || null,
      days: this.normalizeNumber(nextState.days) || baseState.days || null,
      travelType: nextState.travelType || baseState.travelType || null,
      travelers: nextState.travelers || baseState.travelers || null,
      interests,
      pace: nextState.pace || baseState.pace || null,
      style: nextState.style || baseState.style || null,
      period: nextState.period || baseState.period || null,
      departureAirport: nextState.departureAirport || baseState.departureAirport || null,
      preferredTransport: nextState.preferredTransport || baseState.preferredTransport || null,
      hotelStyle: nextState.hotelStyle || baseState.hotelStyle || null
    };
  }

  private normalizePlannerState(raw: any): PlannerState {
    return {
      destination: raw?.destination || null,
      locationId: this.normalizeNumber(raw?.locationId),
      days: this.normalizeNumber(raw?.days),
      travelType: raw?.travelType || null,
      travelers: raw?.travelers || null,
      interests: Array.isArray(raw?.interests) ? raw.interests.filter((entry: unknown) => typeof entry === 'string') : [],
      pace: raw?.pace || null,
      style: raw?.style || null,
      period: raw?.period || null,
      departureAirport: raw?.departureAirport || null,
      preferredTransport: raw?.preferredTransport || null,
      hotelStyle: raw?.hotelStyle || null
    };
  }

  private getMissingPlannerFields(state: PlannerState): string[] {
    const missing: string[] = [];
    if (!state.destination || !state.locationId) missing.push('destinazione');
    if (!state.days) missing.push('giorni');
    if (!state.travelType) missing.push('tipo viaggio');
    if (!state.travelers) missing.push('viaggiatori');
    if (!state.interests?.length) missing.push('interessi');
    if (!state.pace) missing.push('ritmo');
    if (!state.style && !state.hotelStyle) missing.push('stile');
    return missing;
  }

  private isReadyToGenerate(mode: ChatMode, state: PlannerState): boolean {
    if (mode !== 'planner') return false;
    return this.getMissingPlannerFields(state).length === 0;
  }

  private async suggestTitle(
    currentTitle: string | null,
    mode: ChatMode,
    state: PlannerState,
    userMessage: string,
    assistantReply: string,
    isFirstExchange: boolean
  ): Promise<string> {
    if (currentTitle && currentTitle !== DEFAULT_TITLE) {
      return currentTitle;
    }

    if (isFirstExchange) {
      const aiTitle = await this.generateSessionTitle(mode, state, userMessage, assistantReply);
      if (aiTitle) {
        return aiTitle;
      }
    }

    if (state.destination && state.days) {
      return `${state.days} giorni a ${state.destination}`;
    }

    if (state.destination) {
      return `Viaggio a ${state.destination}`;
    }

    return userMessage.split(/[.!?\n]/)[0].slice(0, 48).trim() || DEFAULT_TITLE;
  }

  private async generateSessionTitle(
    mode: ChatMode,
    state: PlannerState,
    userMessage: string,
    assistantReply: string
  ): Promise<string | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const ai = new GoogleGenerativeAI(this.apiKey);
      const model = ai.getGenerativeModel({ model: this.modelName });
      const prompt = [
        'Genera un titolo breve per una chat travel premium di SmartFare.',
        'Restituisci solo il titolo, senza virgolette, markdown o spiegazioni.',
        'Massimo 5 parole.',
        'Il titolo deve essere naturale, specifico e utile nella sidebar.',
        `Modalita: ${mode}.`,
        `Planner state: ${JSON.stringify(state)}.`,
        `Messaggio utente: ${userMessage}`,
        `Risposta assistant: ${assistantReply}`
      ].join('\n');

      const result = await model.generateContent(prompt);
      const rawTitle = result.response.text().replace(/["'*`#]/g, ' ').trim();
      const cleanTitle = rawTitle
        .split('\n')[0]
        ?.replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);

      return cleanTitle || null;
    } catch {
      return null;
    }
  }

  private buildItineraryPrompt(state: PlannerState, messages: DbMessage[]): string {
    const recentUserMessages = messages
      .filter((message) => message.role === 'user')
      .slice(-4)
      .map((message) => message.content)
      .join(' | ');

    return [
      `Crea un itinerario di ${state.days || 3} giorni per ${state.destination}.`,
      state.travelType ? `Tipo di viaggio: ${state.travelType}.` : '',
      state.travelers ? `Viaggiatori: ${state.travelers}.` : '',
      state.interests?.length ? `Interessi principali: ${state.interests.join(', ')}.` : '',
      state.pace ? `Ritmo richiesto: ${state.pace}.` : '',
      state.style ? `Stile generale: ${state.style}.` : '',
      state.hotelStyle ? `Hotel style: ${state.hotelStyle}.` : '',
      state.preferredTransport ? `Mezzi preferiti: ${state.preferredTransport}.` : '',
      state.period ? `Periodo: ${state.period}.` : '',
      'L’itinerario deve essere ricco e completo: ogni giorno deve avere colazione, attività principali, pranzo, attività pomeridiane e cena quando possibile.',
      'Inserisci orari realistici e distribuiti nella giornata.',
      'Se l’utente ha espresso desideri espliciti come Acquario, musei o monumenti, devono comparire davvero nell’itinerario finale.',
      recentUserMessages ? `Indicazioni conversazionali utili: ${recentUserMessages}.` : ''
    ]
      .filter(Boolean)
      .join(' ');
  }

  private buildItineraryDescription(state: PlannerState): string {
    const parts = [
      state.travelType,
      state.travelers,
      state.interests?.length ? `focus ${state.interests.join(', ')}` : null,
      state.pace ? `ritmo ${state.pace}` : null,
      state.style ? `stile ${state.style}` : null
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' · ') : 'Itinerario generato da Voyager AI';
  }

  private buildChatHints(
    mode: ChatMode,
    plannerState: PlannerState,
    transcript: string,
    assistantReply: string,
    workspace: Awaited<ReturnType<ItineraryService['getWorkspaceData']>> | null
  ): { suggestions: ChatHintSuggestion[]; actions: ChatHintAction[] } {
    if (mode !== 'planner' || !workspace?.location) {
      return { suggestions: [], actions: [] };
    }

    const context = `${transcript} ${assistantReply}`.toLowerCase();
    const suggestions: ChatHintSuggestion[] = [];
    const actions: ChatHintAction[] = [];

    const pushSuggestion = (
      poi: { id: number; name: string },
      type: ChatHintSuggestion['type'],
      poiType: 'activity' | 'accommodation' = 'activity',
      description?: string
    ) => {
      if (suggestions.some((entry) => entry.poiId === poi.id && entry.poiType === poiType)) {
        return;
      }

      suggestions.push({
        title: poi.name,
        description,
        type,
        poiId: poi.id,
        poiType
      });
    };

    const matches = (keywords: string[]) => keywords.some((keyword) => context.includes(keyword));

    const museumLike = workspace.activities.filter((activity) => {
      const name = activity.name.toLowerCase();
      const category = activity.category?.name?.toLowerCase() || '';
      return category.includes('muse') || category.includes('monument') || category.includes('landmark') || category.includes('arte') || category.includes('chiese') || category.includes('castelli') || name.includes('acquario') || name.includes('museum');
    });

    const foodLike = workspace.activities.filter((activity) => {
      const category = activity.category?.name?.toLowerCase() || '';
      return ['ristoranti', 'caffe', 'panetterie', 'bar', 'enoteche', 'gelaterie'].includes(category);
    });

    const relaxLike = workspace.activities.filter((activity) => {
      const category = activity.category?.name?.toLowerCase() || '';
      return ['parchi', 'punti panoramici', 'mercati'].includes(category);
    });

    if (matches(['muse', 'cultur', 'arte', 'monument', 'acquario'])) {
      museumLike.slice(0, 3).forEach((activity) => pushSuggestion(activity, 'poi', 'activity', 'Tappa culturale reale nel workspace'));
      actions.push({
        type: 'add_stop',
        label: 'Aggiungi una tappa culturale',
        payload: { focus: 'culture' }
      });
    }

    if (matches(['food', 'ristor', 'pranzo', 'cena', 'aperitivo'])) {
      foodLike.slice(0, 3).forEach((activity) => pushSuggestion(activity, 'food', 'activity', 'Suggerimento food reale'));
      actions.push({
        type: 'optimize_route',
        label: 'Ottimizza il giro food',
        payload: { focus: 'food' }
      });
    }

    if (matches(['notte', 'night', 'sera', 'aperitivo'])) {
      foodLike.slice(0, 2).forEach((activity) => pushSuggestion(activity, 'evening', 'activity', 'Idea per la parte serale'));
      actions.push({
        type: 'create_nostalgic_day',
        label: 'Crea un giorno nostalgico',
        payload: { mood: 'nostalgic' }
      });
    }

    if (matches(['relax', 'natura', 'lento', 'nostalg', 'panorama'])) {
      relaxLike.slice(0, 3).forEach((activity) => pushSuggestion(activity, 'route', 'activity', 'Percorso più lento e panoramico'));
      actions.push({
        type: 'add_day',
        label: 'Aggiungi un giorno slow',
        payload: { pace: 'slow' }
      });
    }

    if (plannerState.days && plannerState.days < 5) {
      actions.push({
        type: 'add_day',
        label: 'Aggiungi un giorno extra',
        payload: { days: plannerState.days + 1 }
      });
    }

    if (suggestions.length === 0) {
      workspace.activities.slice(0, 3).forEach((activity) => pushSuggestion(activity, 'general', 'activity', 'Suggerimento utile dal workspace'));
    }

    return {
      suggestions: suggestions.slice(0, 3),
      actions: actions.slice(0, 3)
    };
  }

  private suggestItineraryName(state: PlannerState): string {
    if (state.destination && state.days) {
      return `${state.destination} in ${state.days} giorni`;
    }

    if (state.destination) {
      return `Viaggio a ${state.destination}`;
    }

    return 'Itinerario SmartFare';
  }

  private buildStartDate(period: string | null): string {
    if (period) {
      const explicitDateMatch = period.match(/\d{4}-\d{2}-\d{2}/);
      if (explicitDateMatch) {
        return explicitDateMatch[0];
      }
    }

    return new Date().toISOString().split('T')[0];
  }

  private buildEndDate(startDate: string, days: number): string {
    const base = new Date(startDate);
    base.setDate(base.getDate() + Math.max(0, days - 1));
    return base.toISOString().split('T')[0];
  }

  private buildRichItineraryItems(
    rawItems: any[],
    plannerState: PlannerState,
    workspace: Awaited<ReturnType<ItineraryService['getWorkspaceData']>>,
    startDate: string,
    transcript: string
  ) {
    const usedActivityIds = new Set<number>();
    const usedAccommodationIds = new Set<number>();
    const activityById = new Map(workspace.activities.map((activity) => [activity.id, activity]));
    const accommodationById = new Map(workspace.accommodations.map((accommodation) => [accommodation.id, accommodation]));

    let items = (rawItems || [])
      .map((item: any, index: number) => ({
        dayNumber: Number(item.dayNumber || 1),
        orderInt: Number(item.orderInt || index + 1),
        itemTypeCode: item.itemTypeCode,
        activityId: item.activityId ?? undefined,
        accommodationId: item.accommodationId ?? undefined,
        note: item.note ?? undefined,
        groupName: item.groupName ?? undefined,
        plannedStartAt: this.resolvePlannedDateTime(startDate, Number(item.dayNumber || 1), item.plannedStartAt || item.timeSlotStart),
        plannedEndAt: this.resolvePlannedDateTime(startDate, Number(item.dayNumber || 1), item.plannedEndAt || item.timeSlotEnd)
      }))
      .filter((item) => item.itemTypeCode === 'ACTIVITY' || item.itemTypeCode === 'ACCOMMODATION')
      .filter((item) => {
        if (item.itemTypeCode === 'ACTIVITY') {
          if (!item.activityId || !activityById.has(item.activityId)) return false;
          usedActivityIds.add(item.activityId);
        }

        if (item.itemTypeCode === 'ACCOMMODATION') {
          if (!item.accommodationId || !accommodationById.has(item.accommodationId)) return false;
          usedAccommodationIds.add(item.accommodationId);
        }

        return true;
      });

    items = this.ensureMustSeeItems(items, workspace, transcript, startDate, usedActivityIds);
    items = this.ensureDailyCoverage(items, plannerState, workspace, startDate, usedActivityIds, usedAccommodationIds);
    items = this.normalizeItineraryItems(items);
    return items;
  }

  private ensureMustSeeItems(
    items: any[],
    workspace: Awaited<ReturnType<ItineraryService['getWorkspaceData']>>,
    transcript: string,
    startDate: string,
    usedActivityIds: Set<number>
  ) {
    const lowerTranscript = transcript.toLowerCase();
    const needsAquarium = lowerTranscript.includes('acquario');
    const hasAquarium = items.some((item) => {
      const activity = item.activityId ? workspace.activities.find((entry) => entry.id === item.activityId) : null;
      return activity?.name.toLowerCase().includes('acquario');
    });

    if (needsAquarium && !hasAquarium) {
      const aquarium = workspace.activities.find(
        (activity) =>
          activity.name.toLowerCase().includes('acquario') &&
          !usedActivityIds.has(activity.id)
      );

      if (aquarium) {
        usedActivityIds.add(aquarium.id);
        items.push({
          dayNumber: 1,
          orderInt: 2,
          itemTypeCode: 'ACTIVITY',
          activityId: aquarium.id,
          note: 'Visita all’Acquario, una delle esperienze chiave richieste per questo viaggio.',
          groupName: 'Mattina: Acquario e Porto Antico',
          plannedStartAt: this.resolvePlannedDateTime(startDate, 1, '10:00'),
          plannedEndAt: this.resolvePlannedDateTime(startDate, 1, '12:00')
        });
      }
    }

    return items;
  }

  private ensureDailyCoverage(
    items: any[],
    plannerState: PlannerState,
    workspace: Awaited<ReturnType<ItineraryService['getWorkspaceData']>>,
    startDate: string,
    usedActivityIds: Set<number>,
    usedAccommodationIds: Set<number>
  ) {
    const totalDays = Math.max(1, plannerState.days || 1);
    const normalizedItems = [...items];

    const foodCandidates = workspace.activities.filter((activity) =>
      ['ristoranti', 'caffe', 'panetterie', 'bar', 'enoteche', 'gelaterie', 'fast food'].includes(
        activity.category?.name?.toLowerCase() || ''
      )
    );
    const cultureCandidates = workspace.activities.filter((activity) =>
      ['musei', 'monumenti', 'landmark', 'chiese', 'castelli', 'punti panoramici', 'teatri', 'mercati', 'artigianato locale'].includes(
        activity.category?.name?.toLowerCase() || ''
      ) || activity.name.toLowerCase().includes('acquario')
    );
    const relaxCandidates = workspace.activities.filter((activity) =>
      ['parchi', 'punti panoramici', 'mercati'].includes(activity.category?.name?.toLowerCase() || '')
    );

    const firstAccommodation = workspace.accommodations[0];
    if (firstAccommodation && !usedAccommodationIds.has(firstAccommodation.id)) {
      usedAccommodationIds.add(firstAccommodation.id);
      normalizedItems.push({
        dayNumber: 1,
        orderInt: 1,
        itemTypeCode: 'ACCOMMODATION',
        accommodationId: firstAccommodation.id,
        note: 'Check-in e sistemazione nella struttura selezionata, punto di partenza per il viaggio.',
        groupName: 'Arrivo e check-in',
        plannedStartAt: this.resolvePlannedDateTime(startDate, 1, '14:30'),
        plannedEndAt: this.resolvePlannedDateTime(startDate, 1, '15:30')
      });
    }

    const slotTemplates = [
      { key: 'breakfast', groupName: 'Colazione locale', start: '08:30', end: '09:30', pool: foodCandidates },
      { key: 'morning', groupName: 'Mattina culturale', start: '10:00', end: '12:00', pool: cultureCandidates },
      { key: 'lunch', groupName: 'Pranzo', start: '13:00', end: '14:15', pool: foodCandidates },
      { key: 'afternoon', groupName: 'Pomeriggio di esplorazione', start: '15:00', end: '17:30', pool: [...cultureCandidates, ...relaxCandidates] },
      { key: 'dinner', groupName: 'Cena', start: '19:30', end: '21:00', pool: foodCandidates }
    ];

    for (let day = 1; day <= totalDays; day++) {
      const dayItems = normalizedItems.filter((item) => item.dayNumber === day);

      for (const slot of slotTemplates) {
        if (dayItems.length >= 5) break;

        const hasSlotCoverage = dayItems.some((item) => {
          const group = String(item.groupName || '').toLowerCase();
          const note = String(item.note || '').toLowerCase();
          return group.includes(slot.key) || group.includes(slot.groupName.toLowerCase()) || note.includes(slot.key);
        });

        if (hasSlotCoverage) {
          continue;
        }

        const candidate = slot.pool.find((activity) => !usedActivityIds.has(activity.id));
        if (!candidate) continue;

        usedActivityIds.add(candidate.id);
        dayItems.push({
          dayNumber: day,
          orderInt: dayItems.length + 1,
          itemTypeCode: 'ACTIVITY',
          activityId: candidate.id,
          note: this.buildSlotNote(candidate.name, slot.groupName, plannerState),
          groupName: slot.groupName,
          plannedStartAt: this.resolvePlannedDateTime(startDate, day, slot.start),
          plannedEndAt: this.resolvePlannedDateTime(startDate, day, slot.end)
        });
      }

      normalizedItems.push(...dayItems.filter((item) => !normalizedItems.includes(item)));
    }

    if (firstAccommodation && !normalizedItems.some((item) => item.dayNumber === totalDays && item.itemTypeCode === 'ACCOMMODATION')) {
      normalizedItems.push({
        dayNumber: totalDays,
        orderInt: 99,
        itemTypeCode: 'ACCOMMODATION',
        accommodationId: firstAccommodation.id,
        note: 'Check-out e chiusura del soggiorno, con tempo per recuperare bagagli e concludere il viaggio con calma.',
        groupName: 'Partenza',
        plannedStartAt: this.resolvePlannedDateTime(startDate, totalDays, '09:00'),
        plannedEndAt: this.resolvePlannedDateTime(startDate, totalDays, '10:00')
      });
    }

    return normalizedItems;
  }

  private normalizeItineraryItems(items: any[]) {
    const ordered = items
      .slice()
      .sort((left, right) => {
        if (left.dayNumber !== right.dayNumber) return left.dayNumber - right.dayNumber;
        const leftStart = left.plannedStartAt || '';
        const rightStart = right.plannedStartAt || '';
        if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
        return (left.orderInt || 0) - (right.orderInt || 0);
      });

    const orderByDay = new Map<number, number>();

    return ordered.map((item) => {
      const nextOrder = (orderByDay.get(item.dayNumber) || 0) + 1;
      orderByDay.set(item.dayNumber, nextOrder);
      return {
        ...item,
        orderInt: nextOrder
      };
    });
  }

  private resolvePlannedDateTime(startDate: string, dayNumber: number, value?: string | null) {
    if (!value) return undefined;

    const timeMatch = String(value).match(/(\d{2}):(\d{2})/);
    if (!timeMatch) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }

    const base = new Date(startDate);
    base.setDate(base.getDate() + Math.max(0, dayNumber - 1));
    base.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    return base.toISOString();
  }

  private buildSlotNote(title: string, slotLabel: string, plannerState: PlannerState) {
    if (slotLabel.toLowerCase().includes('colazione')) {
      return `Sosta rilassata per iniziare la giornata con autenticita locale da ${title}.`;
    }

    if (slotLabel.toLowerCase().includes('pranzo')) {
      return `Pranzo pensato per mantenere un ritmo rilassato, con una pausa gradevole da ${title}.`;
    }

    if (slotLabel.toLowerCase().includes('cena')) {
      return `Cena conclusiva in linea con lo stile del viaggio, con atmosfera locale presso ${title}.`;
    }

    return `Tappa selezionata per un viaggio ${plannerState.pace || 'equilibrato'} con focus su ${plannerState.interests.join(', ') || 'esperienze locali'}: ${title}.`;
  }

  private safeParseJson(text: string): any | null {
    if (!text) return null;

    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch?.[1] || text;
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }

  private normalizeNumber(value: unknown): number | null {
    const parsed = Number(value);
    if (!parsed || Number.isNaN(parsed)) return null;
    return parsed;
  }

  private mapGeminiStreamError(error: any): AppError {
    const status = Number(error?.status || error?.statusCode || 0);
    const retryAfterSeconds = this.extractRetryAfterSeconds(error);

    if (status === 429 || status === 503) {
      const is503 = status === 503;
      const baseMessage = is503
        ? 'I server di Voyager AI sono al momento sovraccarichi per l’alta richiesta.'
        : 'Voyager AI è temporaneamente in sovraccarico.';

      const retryText = retryAfterSeconds
        ? ` Riprova tra circa ${retryAfterSeconds} secondi.`
        : ' Riprova tra un istante.';

      return new AppError(
        `${baseMessage}${retryText}`,
        503,
        {
          code: is503 ? 'AI_SERVICE_UNAVAILABLE' : 'AI_OVERLOADED',
          retryAfterSeconds
        }
      );
    }

    return new AppError('Errore durante la comunicazione con l\'IA', 500);
  }

  private extractRetryAfterSeconds(error: any): number | null {
    const retryDelay = error?.errorDetails?.find?.(
      (detail: any) => detail?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
    )?.retryDelay;

    if (typeof retryDelay !== 'string') {
      return null;
    }

    const seconds = Number.parseInt(retryDelay.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(seconds) ? seconds : null;
  }

  private async findBestLocation(sourceText: string) {
    const text = sourceText?.trim().toLowerCase();
    if (!text) return null;

    const locations = await prisma.location.findMany({
      select: { id: true, name: true }
    });

    const exact = locations.find((location) => text === location.name.toLowerCase());
    if (exact) return exact;

    const contains = locations.find((location) => text.includes(location.name.toLowerCase()));
    if (contains) return contains;

    return null;
  }

  private asMetadata(metadata: unknown): Record<string, any> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {};
    }

    return metadata as Record<string, any>;
  }

  private toDbMessages(messages: Array<{ role: string; content: string; createdAt: Date }>): DbMessage[] {
    return messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
        createdAt: message.createdAt
      }));
  }

  private toJsonValue(value: unknown): any {
    return JSON.parse(JSON.stringify(value));
  }
}
