import { Accommodation } from './accommodation.model';
import { Activity, ActivityCategory } from './activity.model';
import Location from './location.model';

export interface Itinerary {
    id?: number;
    name: string;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    visibilityCode?: string;
    locationId?: number | null;
    chatSessionId?: number | null;
    location?: Location | null;
    userId?: number;
    items?: ItineraryItem[];
    updatedAt?: string;
    isPublished?: boolean;
    imageUrl?: string | null;
    user?: {
        profile?: {
            name?: string;
            surname?: string;
            avatarUrl?: string;
        };
    };
    _count?: {
        items?: number;
    };
    durationDays?: number | null;
}

export interface ItineraryItem {
    id?: number;
    dayNumber: number;
    orderInt: number;
    note?: string;
    itemTypeCode: string;
    activityId?: number;
    accommodationId?: number;
    plannedStartAt?: string | null;
    plannedEndAt?: string | null;
    groupName?: string | null;
    groupStartAt?: string | null;
    groupEndAt?: string | null;
    activity?: Activity;
    accommodation?: Accommodation;
}

export interface ItineraryWorkspace {
    location: Location | null;
    accommodations: Accommodation[];
    activities: Activity[];
    categories: ActivityCategory[];
    draft: Itinerary | null;
}
