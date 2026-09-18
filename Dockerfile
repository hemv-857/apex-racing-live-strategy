# Apex Racing — Live Race Strategy Optimization Platform
# Multi-stage Docker build for Next.js standalone output

FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Generate Prisma client
FROM base AS prisma
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma/
RUN bunx prisma generate

# Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY . .
RUN bun run build

# Production image
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/db ./db

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]