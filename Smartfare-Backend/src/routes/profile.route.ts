import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { upload } from '../config/cloudinary';
import prisma from '../config/prisma';

const router = Router();

const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Troppe richieste. Riprova tra un minuto.' }
});

const updateProfileSchema = z.object({
    name: z.string().trim().max(80).optional(),
    surname: z.string().trim().max(80).optional(),
    city: z.string().trim().max(100).optional(),
    street: z.string().trim().max(200).optional(),
    birthDate: z.string().datetime({ offset: true }).optional().nullable(),
    avatarUrl: z.string().url().max(500).optional().nullable(),
    backgroundImageUrl: z.string().url().max(500).optional().nullable(),
});

const updatePreferencesSchema = z.object({
    travelStyle: z.string().trim().max(100).optional().nullable(),
    pace: z.string().trim().max(50).optional().nullable(),
    preferredTransport: z.string().trim().max(80).optional().nullable(),
    prefersNightlife: z.boolean().optional().nullable(),
    familyFriendly: z.boolean().optional().nullable(),
    budgetLevelCode: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    notes: z.string().trim().max(1000).optional().nullable(),
});

// ─── GET /api/profile/me ──────────────────────────────────────────────────────
router.get('/me', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user!.userId);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                email: true,
                authProvider: true,
                profile: true,
                preference: true,
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        return res.json({
            email: user.email,
            authProvider: user.authProvider,
            profile: user.profile ?? null,
            preference: user.preference ?? null,
        });
    } catch (error) {
        next(error);
    }
});

// ─── PATCH /api/profile/me ────────────────────────────────────────────────────
router.patch('/me', writeLimiter, authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user!.userId);
        const data = updateProfileSchema.parse(req.body);

        const profile = await prisma.userProfile.upsert({
            where: { userId },
            create: {
                userId,
                ...data,
                birthDate: data.birthDate ? new Date(data.birthDate) : null,
            },
            update: {
                ...data,
                birthDate: data.birthDate ? new Date(data.birthDate) : data.birthDate === null ? null : undefined,
            },
        });

        return res.json({ success: true, profile });
    } catch (error) {
        next(error);
    }
});

// ─── PATCH /api/profile/preferences ──────────────────────────────────────────
router.patch('/preferences', writeLimiter, authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user!.userId);
        const data = updatePreferencesSchema.parse(req.body);

        const preference = await prisma.userPreference.upsert({
            where: { userId },
            create: {
                userId,
                budgetLevelCode: data.budgetLevelCode ?? 'MEDIUM',
                ...data,
            },
            update: data,
        });

        return res.json({ success: true, preference });
    } catch (error) {
        next(error);
    }
});

// ─── POST /api/profile/upload/avatar ──────────────────────────────────────────
router.post('/upload/avatar', writeLimiter, authenticateJWT, upload.single('image'), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nessuna immagine fornita' });
        }

        const userId = Number(req.user!.userId);
        const imageUrl = req.file.path;

        await prisma.userProfile.upsert({
            where: { userId },
            create: { userId, avatarUrl: imageUrl },
            update: { avatarUrl: imageUrl },
        });

        return res.json({ success: true, url: imageUrl });
    } catch (error) {
        next(error);
    }
});

// ─── POST /api/profile/upload/background ──────────────────────────────────────
router.post('/upload/background', writeLimiter, authenticateJWT, upload.single('image'), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nessuna immagine fornita' });
        }

        const userId = Number(req.user!.userId);
        const imageUrl = req.file.path;

        await prisma.userProfile.upsert({
            where: { userId },
            create: { userId, backgroundImageUrl: imageUrl },
            update: { backgroundImageUrl: imageUrl },
        });

        return res.json({ success: true, url: imageUrl });
    } catch (error) {
        next(error);
    }
});

export default router;
