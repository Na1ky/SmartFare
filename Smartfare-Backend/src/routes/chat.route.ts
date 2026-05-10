import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import prisma from '../config/prisma';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { ChatService } from '../services/ai/chat.service';
import { AppError } from '../middleware/error.middleware';

const router = Router();
const chatService = new ChatService();

const chatWriteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Troppe operazioni chat. Riprova tra un minuto.'
    }
});

const createSessionSchema = z.object({
    title: z.string().trim().min(1).max(120).optional(),
    mode: z.enum(['planner', 'assistant']).optional(),
    locationId: z.coerce.number().int().positive().nullable().optional()
});

const updateSessionSchema = z
    .object({
        title: z.string().trim().min(1).max(120).optional(),
        isPinned: z.boolean().optional(),
        isActive: z.boolean().optional(),
        mode: z.enum(['planner', 'assistant']).optional()
    })
    .refine((body) => Object.keys(body).length > 0, {
        message: 'Payload di aggiornamento vuoto'
    });

const streamBodySchema = z.object({
    message: z.string().trim().min(1).max(4000)
});

// List sessions
router.get('/sessions', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        console.info(`[CHAT] list sessions userId=${userId}`);
        const sessions = await prisma.chatSession.findMany({
            where: { userId },
            orderBy: [
                { isPinned: 'desc' },
                { lastMessageAt: 'desc' }
            ],
            include: {
                _count: {
                    select: { messages: true }
                }
            }
        });
        res.json(sessions);
    } catch (error) {
        next(error);
    }
});

// Create session
router.post('/sessions', chatWriteLimiter, authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const { title, mode, locationId } = createSessionSchema.parse(req.body);
        const normalizedMode = mode || 'planner';
        console.info(`[CHAT] create session userId=${userId} mode=${normalizedMode} locationId=${locationId || 'none'}`);

        const existingEmptySession = await prisma.chatSession.findFirst({
            where: {
                userId,
                mode: normalizedMode,
                messages: {
                    none: {}
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (existingEmptySession) {
            console.info(`[CHAT] reuse empty session userId=${userId} sessionId=${existingEmptySession.id}`);
            res.status(200).json(existingEmptySession);
            return;
        }

        const session = await prisma.chatSession.create({
            data: {
                userId,
                title: title || 'Nuova conversazione',
                mode: normalizedMode,
                locationId: locationId || null,
                metadata: {
                    plannerState: {
                        destination: null,
                        locationId: locationId || null,
                        days: null,
                        travelType: null,
                        travelers: null,
                        interests: [],
                        pace: null,
                        style: null,
                        period: null,
                        departureAirport: null,
                        preferredTransport: null,
                        hotelStyle: null
                    },
                    readyToGenerate: false
                }
            }
        });

        res.status(201).json(session);
        console.info(`[CHAT] created session userId=${userId} sessionId=${session.id}`);
    } catch (error) {
        next(error);
    }
});

// Get messages
router.get('/sessions/:id/messages', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const chatId = Number(req.params.id);
        console.info(`[CHAT] get messages userId=${userId} sessionId=${chatId}`);

        const session = await prisma.chatSession.findFirst({
            where: { id: chatId, userId }
        });

        if (!session) {
            throw new AppError('Sessione non trovata', 404);
        }

        const messages = await prisma.chatMessage.findMany({
            where: { chatId },
            orderBy: { createdAt: 'asc' }
        });

        res.json(messages);
    } catch (error) {
        next(error);
    }
});

// Update session (pin, rename)
router.patch('/sessions/:id', chatWriteLimiter, authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const chatId = Number(req.params.id);
        const { title, isPinned, isActive, mode } = updateSessionSchema.parse(req.body);
        console.info(`[CHAT] update session userId=${userId} sessionId=${chatId}`);

        const session = await prisma.chatSession.updateMany({
            where: { id: chatId, userId },
            data: {
                ...(title !== undefined && { title }),
                ...(isPinned !== undefined && { isPinned }),
                ...(isActive !== undefined && { isActive }),
                ...(mode !== undefined && { mode })
            }
        });

        if (session.count === 0) {
            throw new AppError('Sessione non trovata', 404);
        }

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Delete session
router.delete('/sessions/:id', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const chatId = Number(req.params.id);
        console.info(`[CHAT] delete session userId=${userId} sessionId=${chatId}`);

        const session = await prisma.chatSession.findFirst({
            where: { id: chatId, userId },
            select: { id: true }
        });

        if (!session) {
            throw new AppError('Sessione non trovata', 404);
        }

        await prisma.$transaction(async (tx) => {
            await tx.chatMessage.deleteMany({
                where: { chatId }
            });

            await tx.chatSession.delete({
                where: { id: chatId }
            });
        });

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Streaming chat endpoint
router.post('/sessions/:id/stream', chatWriteLimiter, authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const chatId = Number(req.params.id);
        const { message } = streamBodySchema.parse(req.body);
        console.info(`[CHAT] stream start userId=${userId} sessionId=${chatId} messageLength=${message.length}`);

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        await chatService.streamChatResponse(userId, chatId, message, (chunk) => {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        });

        res.end();
        console.info(`[CHAT] stream completed userId=${userId} sessionId=${chatId}`);
    } catch (error) {
        // If headers already sent, we can't use next(error) properly for JSON response
        if (!res.headersSent) {
            console.error(`[CHAT] stream failed before headers userId=${req.user?.userId || 'unknown'} sessionId=${req.params.id}`, error);
            next(error);
        } else {
            const appError = error instanceof AppError ? error : new AppError('Errore durante lo streaming', 500);
            console.error(`[CHAT] stream failed after headers userId=${req.user?.userId || 'unknown'} sessionId=${req.params.id}`, appError);
            res.write(`data: ${JSON.stringify({
                reply: appError.message,
                done: true,
                error: true,
                metadata: {
                    code: (appError.details as Record<string, any>)?.code,
                    retryAfterSeconds: (appError.details as Record<string, any>)?.retryAfterSeconds || null
                }
            })}\n\n`);
            res.end();
        }
    }
});

router.post('/sessions/:id/generate-itinerary', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const chatId = Number(req.params.id);

        const itinerary = await chatService.generateItineraryFromSession(userId, chatId);
        res.status(200).json({ success: true, itinerary });
    } catch (error) {
        next(error);
    }
});

export default router;
