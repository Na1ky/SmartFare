import { Itinerary, ItineraryItem } from './itinerary.model';

export type AiChatRole = 'user' | 'assistant';

export interface AiChatMessage {
    role: AiChatRole;
    content: string;
}

export interface AiItineraryChatRequest {
    message: string;
    locationId?: number;
    itinerary?: Pick<Itinerary, 'id' | 'name' | 'startDate' | 'endDate' | 'locationId' | 'items'> | null;
    conversation?: AiChatMessage[];
    preferences?: {
        style?: string;
        pace?: string;
        interests?: string[];
        language?: string;
    };
}

export interface AiItineraryChatSuggestion {
    title: string;
    description?: string;
    type?: 'poi' | 'day' | 'food' | 'evening' | 'route' | 'general';
}

export interface AiItineraryChatAction {
    type: 'suggest' | 'ask_clarification' | 'add_item' | 'remove_item' | 'update_item' | 'reorder_items';
    payload?: Record<string, unknown>;
}

export interface AiItineraryChatResponse {
    reply: string;
    suggestions: AiItineraryChatSuggestion[];
    actions: AiItineraryChatAction[];
    followUpQuestions: string[];
    needsConfirmation: boolean;
}

export interface AiChatEntry {
    id: string;
    role: AiChatRole;
    content: string;
    suggestions?: AiItineraryChatSuggestion[];
    actions?: AiItineraryChatAction[];
    followUpQuestions?: string[];
    needsConfirmation?: boolean;
}
