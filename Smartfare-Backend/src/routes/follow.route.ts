import { Router, Response, NextFunction } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/prisma';

const router = Router();

// ─── POST /api/follow/:userId ─────────────────────────────────────────────────
router.post('/:userId', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const followerId = Number(req.user!.userId);
        const followingId = Number(req.params.userId);

        if (followerId === followingId) {
            return res.status(400).json({ error: 'Non puoi seguire te stesso' });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: followingId } });
        if (!targetUser) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        const follow = await prisma.follow.upsert({
            where: {
                followerId_followingId: {
                    followerId,
                    followingId
                }
            },
            create: {
                followerId,
                followingId
            },
            update: {} // No change if already following
        });

        return res.json({ success: true, follow });
    } catch (error) {
        next(error);
    }
});

// ─── DELETE /api/follow/:userId ───────────────────────────────────────────────
router.delete('/:userId', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const followerId = Number(req.user!.userId);
        const followingId = Number(req.params.userId);

        await prisma.follow.delete({
            where: {
                followerId_followingId: {
                    followerId,
                    followingId
                }
            }
        });

        return res.json({ success: true });
    } catch (error) {
        // If not following, Prisma might throw error, catch it or check existence first
        if ((error as any).code === 'P2025') {
            return res.status(400).json({ error: 'Non segui questo utente' });
        }
        next(error);
    }
});

// ─── GET /api/follow/status/:userId ───────────────────────────────────────────
router.get('/status/:userId', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const followerId = Number(req.user!.userId);
        const followingId = Number(req.params.userId);

        const follow = await prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId,
                    followingId
                }
            }
        });

        return res.json({ isFollowing: !!follow });
    } catch (error) {
        next(error);
    }
});

export default router;
