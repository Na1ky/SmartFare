import { Router, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { ChatService } from '../services/ai/chat.service';
import { AppError } from '../middleware/error.middleware';

const router = Router();
const chatService = new ChatService();

// List sessions
router.get('/sessions', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
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
router.post('/sessions', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const { title, mode, locationId } = req.body;
        const normalizedMode = mode || 'planner';

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
    } catch (error) {
        next(error);
    }
});

// Get messages
router.get('/sessions/:id/messages', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const chatId = Number(req.params.id);

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
router.patch('/sessions/:id', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const chatId = Number(req.params.id);
        const { title, isPinned, isActive, mode } = req.body;

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
router.post('/sessions/:id/stream', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const chatId = Number(req.params.id);
        const { message } = req.body;

        if (!message) {
            throw new AppError('Messaggio mancante', 400);
        }

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        await chatService.streamChatResponse(userId, chatId, message, (chunk) => {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        });

        res.end();
    } catch (error) {
        // If headers already sent, we can't use next(error) properly for JSON response
        if (!res.headersSent) {
            next(error);
        } else {
            const appError = error instanceof AppError ? error : new AppError('Errore durante lo streaming', 500);
            res.write(`data: ${JSON.stringify({
                reply: appError.message,
                done: true,
                error: true,
                metadata: {
                    code: appError.details?.code,
                    retryAfterSeconds: appError.details?.retryAfterSeconds || null
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
