# Polly web — Next.js 16 (standalone) container image.
#
# Build (from the repo root):
#   docker build -t polly-web:latest .
# Run locally (needs real env — see lightsail/ENV_CHECKLIST.md):
#   docker run --rm -p 3000:3000 --env-file .env.production polly-web:latest
#
# Notes:
# - next.config.ts already sets `output: "standalone"`, and the `build`
#   script copies `.next/static` + `public/` into `.next/standalone/`,
#   so the runtime stage only needs `.next/standalone`.
# - `prisma generate` must run BEFORE `next build`: `next build` imports
#   the API routes, which import @prisma/client. Without the generated
#   client the build fails at "Failed to collect page data".
# - DATABASE_URL at build time: only a placeholder is needed. Prisma
#   validates the datasource URL when the client is constructed (module
#   scope in src/lib/db.ts), and `next build` imports the routes, so the
#   build needs the variable to *exist* — it never connects. The real
#   pooled Supabase URL is injected at runtime by Lightsail. If the
#   build ever stops needing it, delete the ARG/ENV pair below.
# - NEXT_PUBLIC_* vars are read server-side at runtime (see
#   src/lib/supabase/client.ts); they are NOT baked in at build time.
#   Do not pass real keys as build args — they would end up in image
#   layers. Set them on the container / Lightsail service instead.
# - Fonts: src/app/layout.tsx uses next/font/google (Geist). The build
#   fetches the font CSS from fonts.googleapis.com, so the build
#   environment needs outbound HTTPS to Google Fonts. In restricted
#   TLS environments (this sandbox included) Turbopack needs
#   NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 — set below.
#   It is harmless on normal hosts; leave it in.

# syntax=docker/dockerfile:1

# ── Stage 1: dependencies + build ──────────────────────────────────────
FROM node:22-bookworm-slim AS builder

# bun is the project's package manager (bun.lock, bun run build).
RUN npm install -g bun@1.4.4

WORKDIR /app

# Install dependencies first (layer cache: rebuilds skip this unless the
# lockfile changes).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Prisma schema + client generation, then the Next.js build.
COPY prisma ./prisma
COPY next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs components.json eslint.config.mjs ./
COPY src ./src
COPY public ./public
COPY packages ./packages

RUN bun run db:generate

ENV NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1
# Build-time placeholder only — never a real credential (see header).
ARG BUILD_DATABASE_URL="postgresql://build:build@localhost:5432/polly"
ENV DATABASE_URL=${BUILD_DATABASE_URL}
RUN bun run build

# ── Stage 2: runtime ───────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user (Next.js standalone docs convention).
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone output (server.js + traced node_modules + static + public).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Prisma engines are not always traced into the standalone output; copy
# them explicitly so the server can start without a missing-engine error.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

# /api exists (src/app/api/route.ts, GET → 200). Do not invent another
# health endpoint. Lightsail uses the same path (see
# lightsail/public-endpoint.json).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
