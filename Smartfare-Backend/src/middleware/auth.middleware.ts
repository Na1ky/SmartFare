import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

const JWT_SECRET = process.env.JWT_SECRET || '';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    sessionId: string;
    avatarUrl?: string | null;
  };
}

type JwtAuthPayload = {
  userId: number;
  email: string;
  sessionId: string;
  avatarUrl?: string | null;
};

function parseBearerToken(headerValue?: string): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return token;
}

function verifyTokenOrThrow(token: string): JwtAuthPayload {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET non configurata');
  }

  const decoded = jwt.verify(token, JWT_SECRET);
  if (!decoded || typeof decoded === 'string') {
    throw new Error('Token payload non valido');
  }

  const payload = decoded as Partial<JwtAuthPayload>;
  if (!payload.userId || !payload.email || !payload.sessionId) {
    throw new Error('Token incompleto');
  }

  return {
    userId: Number(payload.userId),
    email: payload.email,
    sessionId: payload.sessionId,
    avatarUrl: payload.avatarUrl ?? null
  };
}

async function validateUserSession(payload: JwtAuthPayload): Promise<boolean> {
  const session = await prisma.authSession.findUnique({
    where: { id: payload.sessionId },
    select: {
      revokedAt: true,
      userId: true,
      user: {
        select: { email: true }
      }
    }
  });

  if (!session) return false;
  if (session.revokedAt) return false;
  if (session.userId !== payload.userId) return false;
  if (session.user.email !== payload.email) return false;

  return true;
}

export const authenticateJWT = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = parseBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ error: 'Autenticazione richiesta' });
    }

    const payload = verifyTokenOrThrow(token);
    const isValidSession = await validateUserSession(payload);

    if (!isValidSession) {
      return res.status(401).json({ error: 'Sessione non valida o scaduta' });
    }

    req.user = payload;
    next();
  } catch {
    res.status(403).json({ error: 'Token non valido o scaduto' });
  }
};

export const optionalAuthenticateJWT = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const token = parseBearerToken(req.headers.authorization);

    if (!token) {
      next();
      return;
    }

    const payload = verifyTokenOrThrow(token);
    const isValidSession = await validateUserSession(payload);

    if (isValidSession) {
      req.user = payload;
    }
  } catch {
    // Optional auth should not block public routes.
  }

  next();
};
