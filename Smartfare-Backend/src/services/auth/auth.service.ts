import prisma from "../../config/prisma";
import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import crypto, { randomUUID } from "crypto";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import { EmailService } from "../email/email.service";
import {
    LoginParams,
    OAuthProvider,
    OAuthStateData,
    RegisterData,
    SocialProfile
} from "../../models/auth.model";

interface GitHubTokenResponse {
    access_token?: string;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
}

interface GitHubUserResponse {
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
}

interface GitHubEmailResponse {
    email: string;
    primary: boolean;
    verified: boolean;
    visibility: string | null;
}

interface AuthTokenUser {
    id: number;
    email: string;
    avatarUrl?: string | null;
}

interface AuthResult {
    success: boolean;
    token?: string;
    message?: string;
    needsRegistration?: boolean;
    userData?: SocialProfile;
    registrationToken?: string;
}

const emailService = new EmailService();

const JWT_SECRET: string = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || "7d";
const OAUTH_STATE_EXPIRES_IN = "10m";
const OAUTH_REGISTRATION_EXPIRES_IN = "15m";

export class AuthService {
    private readonly googleClient = new OAuth2Client(process.env.ID_CLIENT);

    private getFrontendUrl(): string {
        const frontendUrls = (process.env.FRONTEND_URL || "http://localhost:4200")
            .split(",")
            .map(url => url.trim());
        return frontendUrls.find(url => !url.includes("localhost")) || frontendUrls[0];
    }

    private getBackendUrl(): string {
        return process.env.BACKEND_URL?.trim() || `http://localhost:${process.env.PORT || "3001"}`;
    }

    private sanitizeReturnUrl(returnUrl?: string | null): string {
        if (!returnUrl || !returnUrl.startsWith("/") || returnUrl.startsWith("//")) {
            return "/";
        }
        return returnUrl;
    }

    private buildAuthToken(user: AuthTokenUser, sessionId: string): string {
        return jwt.sign(
            {
                userId: user.id,
                email: user.email,
                username: user.email,
                sessionId,
                avatarUrl: user.avatarUrl
            },
            JWT_SECRET,
            {
                expiresIn: JWT_EXPIRES_IN,
            } as jwt.SignOptions
        );
    }

    private async issueSessionToken(user: AuthTokenUser): Promise<string> {
        const sessionId = randomUUID();
        console.log("Nuovo sessionId generato per " + user.email);

        await prisma.user.update({
            where: { id: user.id },
            data: { sessionId }
        });

        return this.buildAuthToken(user, sessionId);
    }

    private splitDisplayName(displayName?: string | null): { name?: string; surname?: string } {
        const trimmed = displayName?.trim();

        if (!trimmed) {
            return {};
        }

        const parts = trimmed.split(/\s+/);
        if (parts.length === 1) {
            return { name: parts[0] };
        }

        return {
            name: parts[0],
            surname: parts.slice(1).join(" ")
        };
    }

    private createOAuthRegistrationToken(profile: SocialProfile): string {
        return jwt.sign(profile, JWT_SECRET, {
            expiresIn: OAUTH_REGISTRATION_EXPIRES_IN,
        } as jwt.SignOptions);
    }

    private verifyOAuthRegistrationToken(
        token: string,
        expectedEmail: string,
        expectedProvider: Exclude<OAuthProvider, "local">
    ): SocialProfile | null {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (!decoded || typeof decoded === "string") {
                return null;
            }

            const payload = decoded as JwtPayload & Partial<SocialProfile>;
            if (payload.email !== expectedEmail || payload.provider !== expectedProvider) {
                return null;
            }

            return {
                email: payload.email,
                name: payload.name,
                surname: payload.surname,
                avatarUrl: payload.avatarUrl,
                provider: payload.provider
            };
        } catch (error) {
            console.warn("⚠️ Token di registrazione social non valido:", error);
            return null;
        }
    }

    private buildFrontendCallbackUrl(params: Record<string, string | undefined>): string {
        const callbackUrl = new URL("/oauth/callback", this.getFrontendUrl());
        const fragment = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value) {
                fragment.set(key, value);
            }
        });

        callbackUrl.hash = fragment.toString();
        return callbackUrl.toString();
    }

    private async loginOrPrepareSocialRegistration(profile: SocialProfile): Promise<AuthResult> {
        const user = await prisma.user.findUnique({
            where: { email: profile.email },
            select: {
                id: true,
                email: true,
                profile: {
                    select: {
                        avatarUrl: true
                    }
                }
            }
        });

        if (!user) {
            console.log(`Nuovo utente da ${profile.provider}, richiesta completamento registrazione:`, profile.email);
            return {
                success: true,
                needsRegistration: true,
                registrationToken: this.createOAuthRegistrationToken(profile),
                userData: profile
            };
        }

        const token = await this.issueSessionToken({
            id: user.id,
            email: user.email,
            avatarUrl: user.profile?.avatarUrl || profile.avatarUrl
        });

        return {
            success: true,
            token
        };
    }

    private async getGitHubAccessToken(code: string): Promise<string> {
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error("Configurazione GitHub mancante");
        }

        const response = await axios.post<GitHubTokenResponse>(
            "https://github.com/login/oauth/access_token",
            new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: new URL("/auth/github/callback", this.getBackendUrl()).toString()
            }).toString(),
            {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        if (!response.data.access_token) {
            throw new Error(response.data.error_description || "Token GitHub non ricevuto");
        }

        return response.data.access_token;
    }

    private async getGitHubProfile(accessToken: string): Promise<SocialProfile | null> {
        const headers = {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "SmartFare",
            "X-GitHub-Api-Version": "2022-11-28"
        };

        const userResponse = await axios.get<GitHubUserResponse>("https://api.github.com/user", {
            headers
        });

        let email = userResponse.data.email?.trim() || "";

        if (!email) {
            const emailsResponse = await axios.get<GitHubEmailResponse[]>(
                "https://api.github.com/user/emails",
                { headers }
            );

            const preferredEmail =
                emailsResponse.data.find(item => item.primary && item.verified) ||
                emailsResponse.data.find(item => item.verified) ||
                emailsResponse.data.find(item => item.primary) ||
                emailsResponse.data[0];

            email = preferredEmail?.email?.trim() || "";
        }

        if (!email) {
            return null;
        }

        const nameParts = this.splitDisplayName(userResponse.data.name || userResponse.data.login);

        return {
            email,
            name: nameParts.name || userResponse.data.login,
            surname: nameParts.surname,
            avatarUrl: userResponse.data.avatar_url,
            provider: "github"
        };
    }

    createOAuthState(provider: Exclude<OAuthProvider, "local">, mode: "login" | "register", returnUrl?: string): string {
        return jwt.sign(
            {
                provider,
                mode,
                returnUrl: this.sanitizeReturnUrl(returnUrl)
            } satisfies OAuthStateData,
            JWT_SECRET,
            {
                expiresIn: OAUTH_STATE_EXPIRES_IN,
            } as jwt.SignOptions
        );
    }

    verifyOAuthState(state: string): OAuthStateData | null {
        try {
            const decoded = jwt.verify(state, JWT_SECRET);
            if (!decoded || typeof decoded === "string") {
                return null;
            }

            const payload = decoded as JwtPayload & Partial<OAuthStateData>;
            if (
                payload.provider !== "github" ||
                (payload.mode !== "login" && payload.mode !== "register")
            ) {
                return null;
            }

            return {
                provider: payload.provider,
                mode: payload.mode,
                returnUrl: this.sanitizeReturnUrl(payload.returnUrl)
            };
        } catch (error) {
            console.warn("⚠️ State OAuth non valido:", error);
            return null;
        }
    }

    getGitHubAuthorizationUrl(mode: "login" | "register", returnUrl?: string): string {
        const clientId = process.env.GITHUB_CLIENT_ID;
        if (!clientId) {
            throw new Error("Configurazione GitHub mancante");
        }

        const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
        authorizeUrl.searchParams.set("client_id", clientId);
        authorizeUrl.searchParams.set("redirect_uri", new URL("/auth/github/callback", this.getBackendUrl()).toString());
        authorizeUrl.searchParams.set("scope", "read:user user:email");
        authorizeUrl.searchParams.set("state", this.createOAuthState("github", mode, returnUrl));
        return authorizeUrl.toString();
    }

    buildFrontendOAuthRedirect(
        result: Partial<AuthResult> & { error?: string },
        returnUrl?: string
    ): string {
        const safeReturnUrl = this.sanitizeReturnUrl(returnUrl);

        if (result.error) {
            return this.buildFrontendCallbackUrl({
                error: result.error,
                returnUrl: safeReturnUrl
            });
        }

        if (result.token) {
            return this.buildFrontendCallbackUrl({
                token: result.token,
                message: result.message || "Accesso effettuato con successo!",
                returnUrl: safeReturnUrl
            });
        }

        if (result.needsRegistration && result.userData && result.registrationToken) {
            return this.buildFrontendCallbackUrl({
                needsRegistration: "true",
                provider: result.userData.provider,
                registrationToken: result.registrationToken,
                email: result.userData.email,
                name: result.userData.name,
                surname: result.userData.surname,
                avatarUrl: result.userData.avatarUrl,
                returnUrl: safeReturnUrl
            });
        }

        return this.buildFrontendCallbackUrl({
            error: "Risposta OAuth non valida",
            returnUrl: safeReturnUrl
        });
    }

    async Login(loginData: LoginParams): Promise<AuthResult> {
        try {
            const { email, password } = loginData;

            const user = await prisma.user.findUnique({
                where: { email },
                select: {
                    id: true,
                    email: true,
                    passwordHash: true,
                    isEmailVerified: true,
                    profile: {
                        select: {
                            avatarUrl: true
                        }
                    }
                }
            });

            if (!user) {
                return {
                    success: false,
                    message: "Credenziali non valide",
                };
            }

            if (!user.passwordHash) {
                return {
                    success: false,
                    message: "Account configurato per accesso tramite provider esterno",
                };
            }

            if (!user.isEmailVerified) {
                return {
                    success: false,
                    message: "Account non verificato. Controlla la tua email.",
                };
            }

            const verificaPassword = await bcrypt.compare(password, user.passwordHash);

            if (!verificaPassword) {
                return {
                    success: false,
                    message: "Credenziali non valide",
                };
            }

            const token = await this.issueSessionToken({
                id: user.id,
                email: user.email,
                avatarUrl: user.profile?.avatarUrl
            });

            return {
                success: true,
                token
            };

        } catch (error) {
            console.log("❌ Errore durante il login: ", error);
            return {
                success: false,
                message: "Errore durante il login",
            };
        }
    }

    async Register(registerData: RegisterData): Promise<AuthResult> {
        try {
            const existingUser = await prisma.user.findUnique({
                where: { email: registerData.email },
                select: { id: true, isEmailVerified: true }
            });

            if (existingUser) {
                if (existingUser.isEmailVerified) {
                    console.log("Email già esistente");
                    return {
                        success: false,
                        message: "Email già esistente"
                    };
                } else {
                    console.log("Utente non verificato trovato, aggiorno i dati e rinvio la mail...");
                }
            }

            console.log("DATI REGISTRAZIONE RICEVUTI:", JSON.stringify({
                ...registerData,
                password: "[REDACTED]",
                oauthRegistrationToken: registerData.oauthRegistrationToken ? "[REDACTED]" : undefined
            }, null, 2));

            const provider =
                registerData.authProvider === "google" || registerData.authProvider === "github"
                    ? registerData.authProvider
                    : "local";

            const socialProfile = provider === "local"
                ? null
                : registerData.oauthRegistrationToken
                    ? this.verifyOAuthRegistrationToken(registerData.oauthRegistrationToken, registerData.email, provider)
                    : null;

            if (provider !== "local" && !socialProfile) {
                return {
                    success: false,
                    message: "Sessione di autenticazione social non valida. Riprova con il provider scelto.",
                };
            }

            const hashedPassword = await bcrypt.hash(registerData.password, 10);

            const isSocialRegistration = provider !== "local";
            const verificationToken = isSocialRegistration ? null : crypto.randomBytes(32).toString("hex");
            const hashedVerificationToken = verificationToken
                ? crypto.createHash("sha256").update(verificationToken).digest("hex")
                : null;
            const verificationExpires = isSocialRegistration
                ? null
                : new Date(Date.now() + 60 * 60 * 1000);

            if (verificationToken) {
                console.log("🆕 Generato nuovo token di verifica per", registerData.email);
                console.log("⏰ Scadenza impostata:", verificationExpires);
            }

            const userData = {
                passwordHash: hashedPassword,
                authProvider: provider,
                isEmailVerified: isSocialRegistration,
                emailVerificationToken: hashedVerificationToken,
                emailVerificationExpires: verificationExpires,
            };

            const profileData = {
                name: registerData.name || socialProfile?.name || null,
                surname: registerData.surname || socialProfile?.surname || null,
                avatarUrl: registerData.avatarUrl || socialProfile?.avatarUrl || null,
                street: null,
                city: null
            };

            if (existingUser && !existingUser.isEmailVerified) {
                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        ...userData,
                        profile: {
                            upsert: {
                                create: profileData,
                                update: {
                                    name: profileData.name,
                                    surname: profileData.surname,
                                    avatarUrl: profileData.avatarUrl
                                }
                            }
                        }
                    }
                });
            } else {
                await prisma.user.create({
                    data: {
                        email: registerData.email,
                        ...userData,
                        profile: {
                            create: profileData
                        }
                    }
                });
            }

            console.log("Utente creato ", registerData.email);

            if (!isSocialRegistration && verificationToken) {
                const frontendUrl = this.getFrontendUrl();
                const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;
                await emailService.sendVerificationEmail(registerData.email, verificationLink);
            }

            return {
                success: true
            };
        } catch (error) {
            console.log("❌ Errore durante la registrazione: ", error);
            return {
                success: false,
                message: "Errore durante la registrazione",
            };
        }
    }

    async GoogleLogin(idToken: string): Promise<AuthResult> {
        try {
            if (!process.env.ID_CLIENT) {
                return {
                    success: false,
                    message: "Configurazione Google non disponibile",
                };
            }

            const ticket = await this.googleClient.verifyIdToken({
                idToken,
                audience: process.env.ID_CLIENT,
            });
            const payload = ticket.getPayload();

            if (!payload || !payload.email) {
                return {
                    success: false,
                    message: "Token Google non valido",
                };
            }

            return await this.loginOrPrepareSocialRegistration({
                email: payload.email,
                name: payload.given_name,
                surname: payload.family_name,
                avatarUrl: payload.picture,
                provider: "google"
            });

        } catch (error) {
            console.log("❌ Errore durante il login con Google: ", error);
            return {
                success: false,
                message: "Errore durante il login con Google",
            };
        }
    }

    async GitHubLogin(code: string): Promise<AuthResult> {
        try {
            const accessToken = await this.getGitHubAccessToken(code);
            const profile = await this.getGitHubProfile(accessToken);

            if (!profile) {
                return {
                    success: false,
                    message: "Impossibile recuperare un'email valida da GitHub",
                };
            }

            return await this.loginOrPrepareSocialRegistration(profile);
        } catch (error) {
            console.log("❌ Errore durante il login con GitHub: ", error);
            return {
                success: false,
                message: "Errore durante il login con GitHub",
            };
        }
    }

    async ForgotPassword(email: string) {
        try {
            const user = await prisma.user.findUnique({
                where: { email },
            });

            if (!user) {
                return { success: true };
            }

            const resetToken = crypto.randomBytes(32).toString("hex");
            const resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
            const resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    resetPasswordToken,
                    resetPasswordExpires,
                },
            });

            const frontendUrl = this.getFrontendUrl();
            const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

            await emailService.sendPasswordResetEmail(user.email, resetLink);

            return { success: true };
        } catch (error) {
            console.error("❌ Errore durante ForgotPassword:", error);
            return {
                success: false,
                message: "Errore durante il processo di reset password",
            };
        }
    }

    async ResetPassword({ token, newPassword }: { token: string; newPassword: string }) {
        try {
            const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

            const user = await prisma.user.findFirst({
                where: {
                    resetPasswordToken: hashedToken,
                    resetPasswordExpires: {
                        gt: new Date(),
                    },
                },
            });

            if (!user) {
                return {
                    success: false,
                    message: "Token non valido o scaduto",
                };
            }

            const passwordHash = await bcrypt.hash(newPassword, 10);

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash,
                    resetPasswordToken: null,
                    resetPasswordExpires: null,
                    sessionId: null,
                },
            });

            return { success: true };
        } catch (error) {
            console.error("❌ Errore durante ResetPassword:", error);
            return {
                success: false,
                message: "Errore durante l'aggiornamento della password",
            };
        }
    }

    async VerifyEmail(token: string) {
        try {
            const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

            const user = await prisma.user.findFirst({
                where: {
                    emailVerificationToken: hashedToken,
                },
                select: {
                    id: true,
                    email: true,
                    emailVerificationExpires: true,
                    isEmailVerified: true,
                    profile: {
                        select: { avatarUrl: true }
                    }
                }
            });

            if (!user) {
                console.warn("❌ Nessun utente trovato con questo token hash.");
                return {
                    success: false,
                    message: "Link di verifica non valido o scaduto.",
                };
            }

            console.log("👤 Utente trovato:", user.email);

            if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
                console.warn("⚠️ Il token è scaduto.");
                return {
                    success: false,
                    message: "Link di verifica scaduto.",
                };
            }

            if (user.isEmailVerified) {
                console.log("ℹ️ Email già verificata per questo utente.");
            }

            const sessionId = randomUUID();

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    isEmailVerified: true,
                    emailVerificationToken: null,
                    emailVerificationExpires: null,
                    sessionId
                },
            });

            return {
                success: true,
                token: this.buildAuthToken(
                    {
                        id: user.id,
                        email: user.email,
                        avatarUrl: user.profile?.avatarUrl
                    },
                    sessionId
                )
            };
        } catch (error) {
            console.error("❌ Errore durante VerifyEmail:", error);
            return {
                success: false,
                message: "Errore durante la verifica dell'email",
            };
        }
    }
}
