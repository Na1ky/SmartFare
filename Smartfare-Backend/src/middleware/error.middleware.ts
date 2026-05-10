import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 500,
        public details?: Record<string, unknown> | unknown[] | unknown
    ) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const requestId = (req as Request & { requestId?: string }).requestId || 'unknown';

    if (err instanceof ZodError) {
        console.warn(`[Validation Error] requestId=${requestId} ${req.method} ${req.originalUrl} - ${err.issues.map(i => i.message).join(', ')}`);
        return res.status(400).json({
            error: "Errore di validazione",
            details: err.issues.map((e) => ({
                path: e.path.join('.'),
                message: e.message
            }))
        });
    }

    if (err instanceof Error) {
        console.error(`[Error] requestId=${requestId} ${req.method} ${req.originalUrl} - ${err.message}`, err);
    } else {
        console.error(`[Error] requestId=${requestId} ${req.method} ${req.originalUrl}`, err);
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.message,
            details: err.details
        });
    }

    // Default error
    res.status(500).json({
        error: "Errore interno del server"
    });
};
