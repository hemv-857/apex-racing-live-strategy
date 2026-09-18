# Race Service — WebSocket mini-service
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

USER nextjs

EXPOSE 3003
ENV PORT=3003
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "index.ts"]