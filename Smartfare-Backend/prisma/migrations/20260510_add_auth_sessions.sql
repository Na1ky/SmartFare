DROP TABLE IF EXISTS public."AuthSession" CASCADE;

CREATE TABLE public."AuthSession" (
    "id" UUID PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuthSession_userId_idx" ON public."AuthSession"("userId");

CREATE INDEX IF NOT EXISTS "AuthSession_revokedAt_idx" ON public."AuthSession"("revokedAt");

CREATE INDEX IF NOT EXISTS "AuthSession_lastSeenAt_idx" ON public."AuthSession"("lastSeenAt");

ALTER TABLE
    public."User" DROP COLUMN IF EXISTS "sessionId";