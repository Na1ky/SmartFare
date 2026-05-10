import { Router, Request, Response, NextFunction } from "express";
import { AuthService } from '../services/auth/auth.service';
import rateLimit from 'express-rate-limit';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema } from "../schemas/auth.schema";


const router = Router();
const authService = new AuthService();

const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Troppi tentativi. Riprova tra 1 minuto.'
    }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post("/login", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = loginSchema.parse(req.body);
        console.info(`[AUTH] login attempt email=${body.email}`);
        const result = await authService.Login(body);

        if (!result.success) {
            console.warn(`[AUTH] login failed email=${body.email} reason=${result.message || 'unknown'}`);
            return res.status(401).json(result);
        }

        console.info(`[AUTH] login success email=${body.email}`);
        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
});

// ─── POST /auth/register ──────────────────────────────────────────────────────
router.post("/register", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = registerSchema.parse(req.body);
        console.info(`[AUTH] register attempt email=${body.email}`);
        const result = await authService.Register(body);

        if (!result.success) {
            const status = result.message === 'Email già esistente' ? 409 : 400;
            console.warn(`[AUTH] register failed email=${body.email} reason=${result.message || 'unknown'}`);
            return res.status(status).json(result);
        }

        console.info(`[AUTH] register success email=${body.email}`);
        return res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// ─── GET /auth/github ─────────────────────────────────────────────────────────
router.get("/github", authLimiter, (req: Request, res: Response) => {
    try {
        const mode = req.query.mode === 'register' ? 'register' : 'login';
        const returnUrl = typeof req.query.returnUrl === 'string' ? req.query.returnUrl : '/';
        const authorizationUrl = authService.getGitHubAuthorizationUrl(mode, returnUrl);
        return res.redirect(authorizationUrl);
    } catch (error) {
        console.error("❌ Errore durante l'avvio del login GitHub:", error);
        const redirectUrl = authService.buildFrontendOAuthRedirect(
            { error: "Configurazione GitHub non disponibile" },
            typeof req.query.returnUrl === 'string' ? req.query.returnUrl : '/'
        );
        return res.redirect(redirectUrl);
    }
});

// ─── GET /auth/github/callback ────────────────────────────────────────────────
router.get("/github/callback", authLimiter, async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : null;
    const state = typeof req.query.state === 'string' ? req.query.state : null;
    const providerError = typeof req.query.error === 'string' ? req.query.error : null;
    const providerErrorDescription = typeof req.query.error_description === 'string'
        ? req.query.error_description
        : null;

    const verifiedState = state ? authService.verifyOAuthState(state) : null;
    const returnUrl = verifiedState?.returnUrl || '/';

    if (providerError) {
        return res.redirect(
            authService.buildFrontendOAuthRedirect(
                { error: providerErrorDescription || "Autorizzazione GitHub annullata" },
                returnUrl
            )
        );
    }

    if (!code || !state || !verifiedState) {
        return res.redirect(
            authService.buildFrontendOAuthRedirect(
                { error: "Callback GitHub non valida o scaduta" },
                returnUrl
            )
        );
    }

    const result = await authService.GitHubLogin(code);

    if (!result.success) {
        return res.redirect(
            authService.buildFrontendOAuthRedirect(
                { error: result.message || "Errore durante il login con GitHub" },
                returnUrl
            )
        );
    }

    return res.redirect(authService.buildFrontendOAuthRedirect(result, returnUrl));
});

// ─── POST /auth/google ────────────────────────────────────────────────────────
router.post("/google", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { idToken } = req.body;

        if (!idToken || typeof idToken !== 'string') {
            return res.status(400).json({
                error: "Token mancante o non valido",
            });
        }

        console.info("[AUTH] google login attempt");
        const result = await authService.GoogleLogin(idToken);

        if (!result.success) {
            console.warn(`[AUTH] google login failed reason=${result.message || 'unknown'}`);
            return res.status(401).json(result);
        }

        console.info("[AUTH] google login success");
        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────
router.post("/forgot-password", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body);
        console.info(`[AUTH] forgot-password requested email=${email}`);
        const result = await authService.ForgotPassword(email);

        if (!result.success) {
            return res.status(500).json(result);
        }

        return res.status(200).json({ success: true, message: "Se l'email è registrata, riceverai un link per il reset" });
    } catch (error) {
        next(error);
    }
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────
router.post("/reset-password", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = resetPasswordSchema.parse(req.body);
        console.info("[AUTH] reset-password requested");
        const result = await authService.ResetPassword(body);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json({ success: true, message: "Password aggiornata con successo" });
    } catch (error) {
        next(error);
    }
});

// ─── POST /auth/verify-email ──────────────────────────────────────────────────
router.post("/verify-email", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token } = verifyEmailSchema.parse(req.body);
        console.info("[AUTH] verify-email requested");
        const result = await authService.VerifyEmail(token);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
