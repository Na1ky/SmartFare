import { z } from "zod";

export const loginSchema = z.object({
    email: z.string().email("Email non valida"),
    password: z.string().min(6, "La password deve avere almeno 6 caratteri")
});

export const registerSchema = z.object({
    email: z.string().email("Email non valida"),
    password: z.string().min(6, "La password deve avere almeno 6 caratteri"),
    name: z.string().min(1, "Il nome è obbligatorio"),
    surname: z.string().min(1, "Il cognome è obbligatorio"),
    avatarUrl: z.string().url().optional().or(z.literal('')),
    authProvider: z.enum(["local", "google", "github"]).optional(),
    oauthRegistrationToken: z.string().optional()
});

export const forgotPasswordSchema = z.object({
    email: z.string().email("Email non valida")
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, "Token mancante"),
    newPassword: z.string().min(6, "La nuova password deve avere almeno 6 caratteri")
});

export const verifyEmailSchema = z.object({
    token: z.string().min(1, "Token mancante")
});
