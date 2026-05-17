import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticateJWT, AuthRequest, optionalAuthenticateJWT } from '../middleware/auth.middleware';
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
    bio: z.string().trim().max(500).optional().nullable(),
    instagramUrl: z.string().trim().max(100).optional().nullable(),
    twitterUrl: z.string().trim().max(100).optional().nullable(),
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

        const [user, followersCount, followingCount, publicItinerariesCount] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    email: true,
                    authProvider: true,
                    profile: true,
                    preference: true,
                }
            }),
            prisma.follow.count({ where: { followingId: userId } }),
            prisma.follow.count({ where: { followerId: userId } }),
            prisma.itinerary.count({ 
                where: { 
                    userId, 
                    OR: [
                        { isPublished: true },
                        { visibilityCode: 'PUBLIC' }
                    ]
                } 
            })
        ]);

        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        return res.json({
            email: user.email,
            authProvider: user.authProvider,
            profile: user.profile ?? null,
            preference: user.preference ?? null,
            followersCount,
            followingCount,
            publicItinerariesCount
        });
    } catch (error) {
        next(error);
    }
});

// ─── GET /api/profile/top-creators ──────────────────────────────────────────────
router.get('/top-creators', optionalAuthenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const limit = Number(req.query.limit) || 10;
        const currentUserId = req.user?.userId ? Number(req.user.userId) : undefined;

        const users = await prisma.user.findMany({
            where: {
                profile: { isNot: null }
            },
            select: {
                id: true,
                email: true,
                authProvider: true,
                profile: true,
                _count: {
                    select: {
                        followers: true,
                        following: true,
                        itineraries: {
                            where: {
                                OR: [
                                    { isPublished: true },
                                    { visibilityCode: 'PUBLIC' }
                                ]
                            }
                        }
                    }
                }
            },
            orderBy: {
                followers: {
                    _count: 'desc'
                }
            },
            take: limit
        });

        const result = await Promise.all(users.map(async (u) => {
            let isFollowing = false;
            if (currentUserId) {
                const follow = await prisma.follow.findUnique({
                    where: {
                        followerId_followingId: {
                            followerId: currentUserId,
                            followingId: u.id
                        }
                    }
                });
                isFollowing = !!follow;
            }

            return {
                id: u.id,
                email: u.email,
                authProvider: u.authProvider,
                profile: u.profile,
                followersCount: u._count.followers,
                followingCount: u._count.following,
                publicItinerariesCount: u._count.itineraries,
                isFollowing
            };
        }));

        return res.json(result);
    } catch (error) {
        next(error);
    }
});

// ─── GET /api/profile/search ──────────────────────────────────────────────────
router.get('/search', optionalAuthenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const query = (req.query.q as string) || '';
        const limit = Number(req.query.limit) || 10;
        const currentUserId = req.user?.userId ? Number(req.user.userId) : undefined;

        if (!query || query.length < 2) {
            return res.json([]);
        }

        const terms = query.toLowerCase().split(' ').filter(Boolean);
        
        let whereClause: any = { profile: { isNot: null } };
        
        if (terms.length === 1) {
            whereClause.OR = [
                { profile: { name: { contains: terms[0], mode: 'insensitive' } } },
                { profile: { surname: { contains: terms[0], mode: 'insensitive' } } }
            ];
        } else if (terms.length >= 2) {
            whereClause.AND = [
                {
                    OR: [
                        { profile: { name: { contains: terms[0], mode: 'insensitive' } } },
                        { profile: { surname: { contains: terms[0], mode: 'insensitive' } } }
                    ]
                },
                {
                    OR: [
                        { profile: { name: { contains: terms[1], mode: 'insensitive' } } },
                        { profile: { surname: { contains: terms[1], mode: 'insensitive' } } }
                    ]
                }
            ];
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                email: true,
                authProvider: true,
                profile: true,
                _count: {
                    select: {
                        followers: true,
                        following: true,
                        itineraries: {
                            where: {
                                OR: [
                                    { isPublished: true },
                                    { visibilityCode: 'PUBLIC' }
                                ]
                            }
                        }
                    }
                }
            },
            take: limit
        });

        const result = await Promise.all(users.map(async (u) => {
            let isFollowing = false;
            if (currentUserId) {
                const follow = await prisma.follow.findUnique({
                    where: {
                        followerId_followingId: {
                            followerId: currentUserId,
                            followingId: u.id
                        }
                    }
                });
                isFollowing = !!follow;
            }

            return {
                id: u.id,
                email: u.email,
                authProvider: u.authProvider,
                profile: u.profile,
                followersCount: u._count.followers,
                followingCount: u._count.following,
                publicItinerariesCount: u._count.itineraries,
                isFollowing
            };
        }));

        return res.json(result);
    } catch (error) {
        next(error);
    }
});

// ─── GET /api/profile/:id ─────────────────────────────────────────────────────
router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.params.id);

        const [user, followersCount, followingCount, publicItinerariesCount] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    email: true,
                    authProvider: true,
                    profile: true,
                }
            }),
            prisma.follow.count({ where: { followingId: userId } }),
            prisma.follow.count({ where: { followerId: userId } }),
            prisma.itinerary.count({ 
                where: { 
                    userId, 
                    OR: [
                        { isPublished: true },
                        { visibilityCode: 'PUBLIC' }
                    ]
                } 
            })
        ]);

        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        return res.json({
            email: user.email,
            authProvider: user.authProvider,
            profile: user.profile ?? null,
            followersCount,
            followingCount,
            publicItinerariesCount
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
