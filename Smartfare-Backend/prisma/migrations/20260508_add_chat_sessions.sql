CREATE TABLE IF NOT EXISTS public."ChatSession" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "title" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'planner',
    "locationId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChatSession_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS public."ChatMessage" (
    "id" SERIAL PRIMARY KEY,
    "chatId" INTEGER NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES public."ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ChatSession_userId_idx" ON public."ChatSession"("userId");
CREATE INDEX IF NOT EXISTS "ChatSession_userId_isPinned_idx" ON public."ChatSession"("userId", "isPinned");
CREATE INDEX IF NOT EXISTS "ChatSession_userId_createdAt_idx" ON public."ChatSession"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatSession_lastMessageAt_idx" ON public."ChatSession"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_chatId_idx" ON public."ChatMessage"("chatId");
CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx" ON public."ChatMessage"("createdAt");
