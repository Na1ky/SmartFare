import { Router } from 'express';
import { upload } from '../config/cloudinary';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/prisma';

const router = Router();

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Troppi upload in poco tempo. Riprova tra un minuto.'
    }
});

const uploadImageSchema = z.object({
    itineraryId: z.coerce.number().int().positive().optional()
});

router.post('/image', uploadLimiter, authenticateJWT, upload.single('image'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nessuna immagine fornita' });
        }

        const imageUrl = req.file.path;
        const { itineraryId } = uploadImageSchema.parse(req.body);
        let savedToDb = false;

        if (itineraryId && req.user) {
            try {
                const itinerary = await prisma.itinerary.findFirst({
                    where: {
                        id: itineraryId,
                        userId: req.user.userId
                    },
                    select: { id: true }
                });

                if (!itinerary) {
                    return res.status(404).json({ error: 'Itinerario non trovato o non autorizzato' });
                }

                await prisma.itinerary.update({
                    where: {
                        id: itinerary.id
                    },
                    data: { imageUrl: imageUrl }
                });
                savedToDb = true;
                console.log(`Database aggiornato: Itinerario ${itineraryId} -> ${imageUrl}`);
            } catch (dbError) {
                console.error(`Errore aggiornamento DB per itinerario ${itineraryId}:`, dbError);
                // Non blocchiamo la risposta se l'update fallisce (es. itinerario non trovato)
            }
        }

        return res.status(200).json({
            url: imageUrl,
            saved: savedToDb
        });
    } catch (error) {
        console.error('Errore upload immagine:', error);
        return res.status(500).json({ error: 'Errore durante l\'upload o il salvataggio su Cloudinary' });
    }
});

export default router;
