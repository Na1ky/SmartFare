export interface User {
    id: number;
    email: string;
    password?: string;
}

export type OAuthProvider = "local" | "google" | "github";

export interface LoginParams {
    email: string,
    password: string;
}

export interface RegisterData {
    email: string,
    password: string,
    name?: string;
    surname?: string;
    authProvider?: OAuthProvider;
    oauthRegistrationToken?: string;
    avatarUrl?: string;
    street?: string;
    city?: string;
}

export interface SocialProfile {
    email: string;
    name?: string;
    surname?: string;
    avatarUrl?: string;
    provider: Exclude<OAuthProvider, "local">;
}

export interface OAuthStateData {
    provider: Exclude<OAuthProvider, "local">;
    mode: "login" | "register";
    returnUrl: string;
}
