import { Router, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../config/prisma';
import { optionalAuthenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { aiItineraryChatSchema } from '../schemas/ai.schema';
import { aiItineraryGenerateSchema } from '../schemas/ai-generate.schema';
import { ItineraryService } from '../services/itinerary/itinerary.service';
import { GeminiItineraryChatService } from '../services/ai/gemini.service';
import { AppError } from '../middleware/error.middleware';

const router = Router();
const itineraryService = new ItineraryService();
const geminiService = new GeminiItineraryChatService();

const aiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Troppi messaggi AI. Riprova tra 1 minuto.'
    }
});

router.post('/itinerary/chat', aiLimiter, optionalAuthenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const body = aiItineraryChatSchema.parse(req.body);
        const locationId = body.locationId || body.itinerary?.locationId;
        console.info(`[AI] itinerary chat started locationId=${locationId || 'missing'} userId=${req.user?.userId || 'guest'}`);

        if (!locationId) {
            throw new AppError('locationId mancante per avviare la chat IA', 400);
        }

        const workspace = await itineraryService.getWorkspaceData(locationId, req.user?.userId ? Number(req.user.userId) : undefined);

        const response = await geminiService.generateChatResponse(body, {
            location: workspace.location
                ? {
                    id: workspace.location.id,
                    name: workspace.location.name,
                    city: workspace.location.name,
                    province: workspace.location.province ?? undefined,
                    country: 'Italia',
                }
                : null,
            itinerary: body.itinerary || workspace.draft,
            accommodations: workspace.accommodations,
            activities: workspace.activities,
            categories: workspace.categories,
        });

        res.status(200).json({
            success: true,
            ...response,
        });
        console.info(`[AI] itinerary chat completed locationId=${locationId} userId=${req.user?.userId || 'guest'}`);
    } catch (error) {
        console.error(`[AI] itinerary chat failed userId=${req.user?.userId || 'guest'}`, error);
        next(error);
    }
});

router.post('/itinerary/generate', aiLimiter, optionalAuthenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { prompt } = aiItineraryGenerateSchema.parse(req.body);
        console.info(`[AI] itinerary generate started userId=${req.user?.userId || 'guest'} promptLength=${prompt.length}`);

        // 1. Fetch all locations to identify the destination
        const locations = await prisma.location.findMany({
            select: { id: true, name: true }
        });

        const locationId = await geminiService.identifyLocation(prompt, locations);

        if (!locationId) {
            throw new AppError('Non sono riuscito a identificare una destinazione valida per la tua richiesta. Prova a specificare meglio la città.', 400);
        }

        // 2. Fetch workspace data for the identified location
        const workspace = await itineraryService.getWorkspaceData(locationId, req.user?.userId ? Number(req.user.userId) : undefined);

        // 3. Generate the initial itinerary
        const response = await geminiService.generateInitialItinerary(prompt, {
            location: workspace.location
                ? {
                    id: workspace.location.id,
                    name: workspace.location.name,
                    city: workspace.location.name,
                    province: workspace.location.province ?? undefined,
                    country: 'Italia',
                }
                : null,
            itinerary: null,
            accommodations: workspace.accommodations,
            activities: workspace.activities,
            categories: workspace.categories,
        });

        if (!response) {
            throw new AppError('Errore durante la generazione dell\'itinerario. Riprova.', 500);
        }

        res.status(200).json({
            success: true,
            itinerary: {
                ...response,
                locationId,
                location: workspace.location
            }
        });
        console.info(`[AI] itinerary generate completed userId=${req.user?.userId || 'guest'} locationId=${locationId}`);
    } catch (error) {
        console.error(`[AI] itinerary generate failed userId=${req.user?.userId || 'guest'}`, error);
        next(error);
    }
});

export default router;
