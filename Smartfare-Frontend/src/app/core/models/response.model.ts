export interface AuthResponse {
    success: boolean;
    token?: string;
    message?: string;
    needsRegistration?: boolean;
    registrationToken?: string;
    userData?: {
        email: string;
        name?: string;
        surname?: string;
        avatarUrl?: string;
        provider?: 'google' | 'github';
    };
}
