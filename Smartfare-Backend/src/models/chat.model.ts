export type ChatMode = 'planner' | 'assistant';
export type ChatRole = 'user' | 'assistant';

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

export interface ChatSessionDto {
  id: number;
  userId: number;
  title: string | null;
  mode: ChatMode;
  locationId: number | null;
  isActive: boolean;
  isPinned: boolean;
  metadata: any;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageDto {
  id: number;
  chatId: number;
  role: ChatRole;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChatSessionRequest {
  title?: string;
  mode?: ChatMode;
  locationId?: number;
  initialMessage?: string;
}

export interface SendMessageRequest {
  message: string;
  mode?: ChatMode; // allow switching mode mid-conversation if needed
}

export interface ChatStreamResponse {
  reply: string;
  done: boolean;
  metadata?: {
    suggestedTitle?: string;
    plannerState?: PlannerState;
    readyToGenerate?: boolean;
    itineraryData?: any;
    suggestions?: Array<{
      title: string;
      description?: string;
      type: 'poi' | 'day' | 'food' | 'evening' | 'route' | 'general';
      poiId?: number | null;
      poiType?: 'activity' | 'accommodation' | null;
    }>;
    actions?: Array<{
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
    }>;
  };
}
