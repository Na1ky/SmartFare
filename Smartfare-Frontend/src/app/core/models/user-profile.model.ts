export interface UserProfile {
  id?: number;
  name?: string | null;
  surname?: string | null;
  city?: string | null;
  street?: string | null;
  avatarUrl?: string | null;
  backgroundImageUrl?: string | null;
  bio?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  birthDate?: string | null;
}

export interface UserPreference {
  id?: number;
  travelStyle?: string | null;
  pace?: string | null;
  preferredTransport?: string | null;
  prefersNightlife?: boolean | null;
  familyFriendly?: boolean | null;
  budgetLevelCode?: string | null;
  notes?: string | null;
}

export interface UserProfileFull {
  email: string;
  authProvider: string;
  profile: UserProfile | null;
  preference: UserPreference | null;
  followersCount?: number;
  followingCount?: number;
  publicItinerariesCount?: number;
}
