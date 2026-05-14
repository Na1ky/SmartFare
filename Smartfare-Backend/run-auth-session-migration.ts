import prisma from "./src/config/prisma";

async function runAuthSessionMigration() {
    console.log("🔄 Starting auth session migration...");

    try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS public."AuthSession" CASCADE;`);

        await prisma.$executeRawUnsafe(`
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
    `);

        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuthSession_userId_idx" ON public."AuthSession"("userId");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuthSession_revokedAt_idx" ON public."AuthSession"("revokedAt");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuthSession_lastSeenAt_idx" ON public."AuthSession"("lastSeenAt");`);
        await prisma.$executeRawUnsafe(`ALTER TABLE public."User" DROP COLUMN IF EXISTS "sessionId";`);

        console.log("✅ Auth session migration completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Auth session migration failed:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runAuthSessionMigration();