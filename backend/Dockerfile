# ─── Build stage ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

WORKDIR /app

# Install OS deps needed by Prisma engines.
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Only copy what's needed for dependency install so this layer caches well.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Copy source + build.
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# ─── Runtime stage ────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Non-root user for runtime.
RUN useradd -r -u 1001 -g nogroup waste
USER waste

COPY --from=build --chown=waste:nogroup /app/node_modules ./node_modules
COPY --from=build --chown=waste:nogroup /app/dist ./dist
COPY --from=build --chown=waste:nogroup /app/prisma ./prisma
COPY --from=build --chown=waste:nogroup /app/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/index.js"]
