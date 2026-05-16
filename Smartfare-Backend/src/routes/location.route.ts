import { Router, Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";

const router = Router();

// ─── GET /api/locations────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { q } = req.query;
        let where = {};

        if (q && typeof q === 'string' && q.length >= 2) {
            const query = q.toLowerCase();
            const queryDigits = q.replace(/\D/g, '');

            where = {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { province: { contains: query, mode: 'insensitive' } },
                    { cap: queryDigits ? { contains: queryDigits } : undefined }
                ]
            };
        } else if (q) {
            return res.status(200).send([]);
        }

        const locations = await prisma.location.findMany({
            where,
            take: 10
        });

        res.status(200).send(locations);
    } catch (error: any) {
        next(error);
    }
});

// ─── GET /api/locations/random-image ──────────────────────────────────
router.get('/random-image', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const locationsWithImages = await prisma.location.findMany({
            where: { image: { not: null } },
            select: { image: true }
        });

        if (locationsWithImages.length === 0) {
            return res.json({ imageUrl: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2000&auto=format&fit=crop' });
        }

        const randomLoc = locationsWithImages[Math.floor(Math.random() * locationsWithImages.length)];
        res.json({ imageUrl: randomLoc.image });
    } catch (error) {
        next(error);
    }
});

export default router;
