export type AiChatRole = 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiItineraryItemSnapshot {
  id?: number;
  dayNumber: number;
  orderInt: number;
  note?: string | null;
  itemTypeCode: 'ACTIVITY' | 'ACCOMMODATION' | 'TRANSPORT';
  activityId?: number | null;
  accommodationId?: number | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  groupName?: string | null;
  groupStartAt?: string | null;
  groupEndAt?: string | null;
}

export interface AiItinerarySnapshot {
  id?: number;
  name?: string;
  startDate?: string | null;
  endDate?: string | null;
  locationId?: number | null;
  items?: AiItineraryItemSnapshot[];
}

export interface AiItineraryChatRequest {
  message: string;
  locationId?: number;
  itinerary?: AiItinerarySnapshot | null;
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

export interface AiItineraryWorkspaceContext {
  location: {
    id: number;
    name?: string;
    city?: string;
    province?: string;
    country?: string;
  } | null;
  itinerary: AiItinerarySnapshot | null;
  accommodations: Array<{
    id: number;
    name: string;
    street?: string | null;
    latitude: number;
    longitude: number;
    stars?: number | null;
    pricePerNight?: number | null;
  }>;
  activities: Array<{
    id: number;
    name: string;
    street?: string | null;
    latitude: number;
    longitude: number;
    price?: number | null;
    rating?: number | null;
    category?: { id: number; name: string } | null;
  }>;
  categories: Array<{
    id: number;
    name: string;
  }>;
}
