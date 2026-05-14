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
    poiId?: number | null;
    poiType?: 'activity' | 'accommodation' | null;
}

export interface AiItineraryChatAction {
    type: 'suggest' | 'ask_clarification' | 'add_item' | 'remove_item' | 'update_item' | 'reorder_items' | 'add_day' | 'create_nostalgic_day' | 'reorder_route' | 'optimize_route' | 'add_stop' | 'remove_stop' | 'focus_poi' | 'generate_itinerary';
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
