import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prisma is the app data layer. It connects to Supabase Postgres via the
// pooled connection string in DATABASE_URL (Supavisor, port 6543); schema
// changes / migrations use DIRECT_URL (direct Postgres, port 5432).
// Row Level Security (see supabase/rls.sql) governs direct Supabase-client
// access; Prisma connects with a privileged role, so RLS does not gate
// these queries — identity/authorization is enforced in the API layer
// (src/lib/polly/session.ts) instead.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
