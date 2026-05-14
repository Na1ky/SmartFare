import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppError } from '../../middleware/error.middleware';
import {
    AiItineraryChatRequest,
    AiItineraryChatResponse,
    AiItineraryWorkspaceContext,
} from '../../models/ai.model';

type GeminiTextPart = {
    text?: string;
};

export class GeminiItineraryChatService {
    private readonly apiKey = process.env.GEMINI_API_KEY;
    private readonly modelName = this.resolveModelName(process.env.GEMINI_MODEL);

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
            ...fallbackModels,
        ];

        const validModel = candidates.find((model) => /^gemini-[a-z0-9.-]+$/i.test(model));
        return validModel || 'gemini-2.0-flash';
    }

    private async callGeminiWithRetry(model: any, prompt: string, retries = 2): Promise<any> {
        for (let i = 0; i <= retries; i++) {
            try {
                return await model.generateContent(prompt);
            } catch (error: any) {
                const isNetworkError = error?.message?.includes('fetch failed') || error?.code === 'UND_ERR_CONNECT_TIMEOUT';
                if (isNetworkError && i < retries) {
                    console.log(`Gemini API Fetch failed (attempt ${i + 1}/${retries + 1}), retrying...`);
                    await new Promise(res => setTimeout(res, 1000 * (i + 1))); // Exponential backoff
                    continue;
                }
                throw error;
            }
        }
    }

    async generateChatResponse(
        userInput: AiItineraryChatRequest,
        workspace: AiItineraryWorkspaceContext
    ): Promise<AiItineraryChatResponse> {
        if (!this.apiKey) {
            throw new AppError('GEMINI_API_KEY mancante', 500);
        }

        const ai = new GoogleGenerativeAI(this.apiKey);
        const model = ai.getGenerativeModel({ model: this.modelName });

        const prompt = this.buildPrompt(userInput, workspace);

        try {
            const result = await this.callGeminiWithRetry(model, prompt);
            const responseText = this.extractText(result.response.candidates?.[0]?.content?.parts ?? []);
            return this.parseResponse(responseText);
        } catch (error: any) {
            console.error("Gemini API Error:", error);

            if (error?.status === 429 || error?.message?.includes('429')) {
                return {
                    reply: "Il sistema è temporaneamente sovraccarico (limite quota raggiunto). Riprova tra circa un minuto.",
                    suggestions: [],
                    actions: [],
                    followUpQuestions: ["Vuoi riprovare tra un istante?"],
                    needsConfirmation: false
                };
            }

            throw error;
        }
    }

    private buildPrompt(userInput: AiItineraryChatRequest, workspace: AiItineraryWorkspaceContext): string {
        const itineraryItems = (userInput.itinerary?.items || workspace.itinerary?.items || []).map((item) => ({
            d: item.dayNumber,
            o: item.orderInt,
            type: item.itemTypeCode,
            actId: item.activityId || undefined,
            accId: item.accommodationId || undefined,
            note: item.note || undefined
        }));

        const conversation = (userInput.conversation || []).slice(-5); // Reduced history

        // Limit the number of POIs to reduce token usage
        const activities = (workspace.activities || [])
            .slice(0, 40)
            .map(a => ({ id: a.id, name: a.name, categoryId: a.category?.id }));
        const accommodations = (workspace.accommodations || [])
            .slice(0, 20)
            .map(acc => ({ id: acc.id, name: acc.name, stars: acc.stars }));

        return [
            'Sei l\'assistente IA di SmartFare per l\'itinerary builder.',
            'Rispondi sempre in italiano.',
            'Usa solo i POI presenti nel workspace fornito.',
            'Non inventare luoghi, hotel o attività che non esistono nel contesto.',
            'Se il messaggio dell\'utente richiede una modifica, proponi un piano chiaro e operazioni sicure.',
            'Se mancano informazioni, fai domande brevi e specifiche.',
            'Restituisci SOLO JSON valido, senza markdown, senza backticks e senza testo extra.',
            'Formato richiesto:',
            '{"reply":"string","suggestions":[{"title":"string","description":"string","type":"poi|day|food|evening|route|general"}],"actions":[{"type":"suggest|ask_clarification|add_item|remove_item|update_item|reorder_items","payload":{}}],"followUpQuestions":["string"],"needsConfirmation":true}',
            '',
            `Messaggio utente: ${userInput.message}`,
            userInput.preferences ? `Preferenze: ${JSON.stringify(userInput.preferences)}` : 'Preferenze: non fornite',
            `Contesto destinazione: ${JSON.stringify(workspace.location)}`,
            `Itinerario corrente: ${JSON.stringify(userInput.itinerary || workspace.itinerary)}`,
            `Tappe correnti: ${JSON.stringify(itineraryItems)}`,
            `Alloggi disponibili: ${JSON.stringify(accommodations)}`,
            `Attività disponibili: ${JSON.stringify(activities)}`,
            `Categorie: ${JSON.stringify(workspace.categories)}`,
            conversation.length > 0 ? `Storico conversazione: ${JSON.stringify(conversation)}` : 'Storico conversazione: vuoto',
        ].join('\n');
    }

    private extractText(parts: GeminiTextPart[]): string {
        return parts
            .map((part) => part.text || '')
            .join('\n')
            .trim();
    }

    private parseResponse(text: string): AiItineraryChatResponse {
        const parsed = this.tryParseJson(text);
        if (parsed) {
            return {
                reply: typeof parsed.reply === 'string' ? parsed.reply : text,
                suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
                actions: Array.isArray(parsed.actions) ? parsed.actions : [],
                followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [],
                needsConfirmation: Boolean(parsed.needsConfirmation),
            };
        }

        return {
            reply: text || 'Non sono riuscito a generare una risposta strutturata.',
            suggestions: [],
            actions: [],
            followUpQuestions: [],
            needsConfirmation: false,
        };
    }

    private tryParseJson(text: string): any {
        if (!text) return null;

        const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fencedMatch?.[1] || text;

        const firstBrace = candidate.indexOf('{');
        const lastBrace = candidate.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
            return null;
        }

        const jsonSlice = candidate.slice(firstBrace, lastBrace + 1);
        try {
            return JSON.parse(jsonSlice);
        } catch {
            return null;
        }
    }

    async identifyLocation(prompt: string, locations: { id: number, name: string }[]): Promise<number | null> {
        if (!this.apiKey) throw new AppError('GEMINI_API_KEY mancante', 500);

        // --- FALLBACK: Local Matching ---
        const promptLower = prompt.toLowerCase();
        for (const loc of locations) {
            const locNameLower = loc.name.toLowerCase();
            const regex = new RegExp(`\\b${locNameLower}\\b`, 'i');
            if (regex.test(promptLower)) {
                return loc.id;
            }
        }

        const ai = new GoogleGenerativeAI(this.apiKey);
        const model = ai.getGenerativeModel({ model: this.modelName });

        const systemPrompt = [
            'Sei un esperto di viaggi.',
            'Dato un prompt dell\'utente e una lista di nomi di location, identifica quale location è la più pertinente.',
            'Se non trovi una corrispondenza esatta, scegli la più vicina.',
            'Se non c\'è alcuna corrispondenza sensata, restituisci "null".',
            'Restituisci SOLO il NOME della location identificata o la stringa "null".',
            '',
            `Lista location: ${locations.map(l => l.name).join(', ')}`,
            `Prompt utente: "${prompt}"`
        ].join('\n');

        try {
            const result = await this.callGeminiWithRetry(model, systemPrompt);
            const text = this.extractText(result.response.candidates?.[0]?.content?.parts ?? []);
            
            if (text.toLowerCase().includes('null')) return null;
            
            const identifiedName = text.trim().toLowerCase();
            const found = locations.find(l => l.name.toLowerCase() === identifiedName || identifiedName.includes(l.name.toLowerCase()));
            return found ? found.id : null;
        } catch (error: any) {
            console.error("Gemini identifyLocation Error:", error);
            const broadMatch = locations.find(l => promptLower.includes(l.name.toLowerCase()));
            if (broadMatch) return broadMatch.id;
            return null;
        }
    }

    async generateInitialItinerary(prompt: string, workspace: AiItineraryWorkspaceContext): Promise<any> {
        if (!this.apiKey) throw new AppError('GEMINI_API_KEY mancante', 500);
        const ai = new GoogleGenerativeAI(this.apiKey);
        const model = ai.getGenerativeModel({ model: this.modelName });

        const rankedActivities = this.rankActivitiesForPrompt(prompt, workspace.activities || []);
        const activities = rankedActivities
            .slice(0, 80)
            .map(a => ({ id: a.id, name: a.name, category: a.category?.name }));
        const accommodations = (workspace.accommodations || [])
            .slice(0, 20)
            .map(acc => ({ id: acc.id, name: acc.name, stars: acc.stars }));

        const highlightedActivities = rankedActivities
            .slice(0, 20)
            .map(a => `${a.name} [${a.category?.name || 'senza categoria'}] (#${a.id})`);

        const foodActivities = rankedActivities
            .filter((activity) => ['Ristoranti', 'Caffe', 'Panetterie', 'Bar', 'Enoteche', 'Gelaterie'].includes(activity.category?.name || ''))
            .slice(0, 20)
            .map(a => `${a.name} [${a.category?.name}] (#${a.id})`);

        const cultureActivities = rankedActivities
            .filter((activity) => ['Musei', 'Monumenti', 'Landmark', 'Chiese', 'Castelli', 'Punti panoramici'].includes(activity.category?.name || '') || activity.name.toLowerCase().includes('acquario'))
            .slice(0, 25)
            .map(a => `${a.name} [${a.category?.name || 'senza categoria'}] (#${a.id})`);

        const systemPrompt = [
            'Sei un assistente esperto di viaggi SmartFare.',
            `L'utente vuole organizzare un viaggio a ${workspace.location?.name}.`,
            `Richiesta specifica: "${prompt}"`,
            '',
            'Usa i POI (attività e alloggi) forniti per costruire un itinerario di 3-5 giorni.',
            'Puoi usare SOLO activityId e accommodationId realmente presenti nelle liste qui sotto.',
            'Non riutilizzare ID di esempio, non inventare ID, non usare placeholder.',
            'L’itinerario deve essere ricco, concreto e ben distribuito.',
            'Ogni giorno deve includere una struttura completa con momenti come colazione, una visita o esperienza forte al mattino, pranzo, esperienza pomeridiana e cena quando il catalogo lo consente.',
            'Se l’utente ha chiesto esplicitamente luoghi come Acquario, musei o monumenti, questi elementi devono essere presenti davvero nell’output se esistono nelle liste disponibili.',
            'Non creare giornate vuote o con una sola attività, salvo impossibilità assoluta del catalogo.',
            'Per ogni tappa, specifica dayNumber, orderInt, itemTypeCode (ACTIVITY o ACCOMMODATION), activityId o accommodationId, note, groupName, timeSlotStart e timeSlotEnd.',
            'Usa timeSlotStart e timeSlotEnd nel formato HH:mm.',
            'Restituisci anche una description narrativa sintetica dell’itinerario.',
            'Il groupName serve per raggruppare le attività della giornata (es. "Mattina", "Pomeriggio", "Cena").',
            'Sii creativo ma coerente con la richiesta dell\'utente.',
            'Restituisci SOLO JSON valido.',
            '',
            'Esempio formato:',
            '{"name":"Titolo Viaggio","description":"Breve descrizione","items":[{"dayNumber":1,"orderInt":1,"itemTypeCode":"ACTIVITY","activityId":123,"note":"Descrizione","groupName":"Colazione locale","timeSlotStart":"08:30","timeSlotEnd":"09:30"}]}',
            '',
            `Attività prioritarie e più rilevanti: ${JSON.stringify(highlightedActivities)}`,
            `Attività culturali / must-see: ${JSON.stringify(cultureActivities)}`,
            `Attività food / pause: ${JSON.stringify(foodActivities)}`,
            `Attività disponibili: ${JSON.stringify(activities)}`,
            `Alloggi disponibili: ${JSON.stringify(accommodations)}`,
        ].join('\n');

        try {
            const result = await this.callGeminiWithRetry(model, systemPrompt);
            const responseText = this.extractText(result.response.candidates?.[0]?.content?.parts ?? []);
            return this.tryParseJson(responseText);
        } catch (error: any) {
            console.error("Gemini generateInitialItinerary Error:", error);
            return null;
        }
    }

    private rankActivitiesForPrompt(prompt: string, activities: AiItineraryWorkspaceContext['activities']) {
        const lowerPrompt = prompt.toLowerCase();

        return [...activities].sort((left, right) => {
            return this.scoreActivityForPrompt(right, lowerPrompt) - this.scoreActivityForPrompt(left, lowerPrompt);
        });
    }

    private scoreActivityForPrompt(activity: AiItineraryWorkspaceContext['activities'][number], prompt: string): number {
        let score = 0;
        const name = activity.name.toLowerCase();
        const category = activity.category?.name?.toLowerCase() || '';

        if (name.includes('acquario')) score += 120;
        if (prompt.includes('acquario') && name.includes('acquario')) score += 200;
        if (prompt.includes('muse') && (category.includes('muse') || name.includes('muse'))) score += 120;
        if (prompt.includes('monument') && (category.includes('monument') || category.includes('landmark') || name.includes('monument'))) score += 100;
        if (prompt.includes('autentic') && ['mercati', 'artigianato locale', 'chiese', 'landmark'].includes(category)) score += 70;
        if (prompt.includes('rilassat') && ['parchi', 'punti panoramici', 'caffe', 'ristoranti'].includes(category)) score += 55;

        if (['musei', 'monumenti', 'landmark', 'chiese', 'castelli', 'punti panoramici'].includes(category)) score += 60;
        if (['ristoranti', 'caffe', 'panetterie', 'bar', 'enoteche', 'gelaterie'].includes(category)) score += 45;
        if (['mercati', 'artigianato locale'].includes(category)) score += 35;
        if (['fermate bus', 'parcheggi', 'farmacie', 'benzinai'].includes(category)) score -= 80;

        return score;
    }
}
