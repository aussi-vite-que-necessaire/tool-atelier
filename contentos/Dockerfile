# syntax=docker/dockerfile:1

# Image unique servant DEUX rôles dans l'atelier lab :
#  - web    : serveur Next standalone (CMD par défaut → node server.js, port 8080) ;
#  - worker : consumers BullMQ (src/worker/index.ts via tsx) — le service `worker`
#             du compose override la commande.
# Le one-shot `migrate` (scripts/migrate.mjs) tourne aussi sur cette image.

# --- deps : toutes les dépendances (devDeps incluses) ---
# Le build Next en a besoin ; le worker s'exécute via tsx (devDep) au runtime.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build : compile Next en sortie standalone ---
# Les placeholders satisfont la validation zod de src/lib/env.ts pendant
# `next build` ; les vraies valeurs sont lues au runtime (env injecté par lab).
# APP_URL n'est pas inliné côté client (lecture runtime) mais on fige tout de
# même la valeur lab par défaut au cas où une route le capturerait au build.
FROM node:22-slim AS build
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG APP_URL=https://contentos.lab.avqn.ch
ENV APP_URL=${APP_URL}
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
    REDIS_URL=redis://localhost:6379 \
    BETTER_AUTH_SECRET=build-placeholder-secret-build-placeholder-secret
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runner : image finale (web par défaut, worker en override) ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Sortie standalone de Next : serveur web + node_modules tracés (web).
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Le worker tourne sur la MÊME image : il lui faut le code source TypeScript,
# l'ensemble des deps (tsx + bullmq + ioredis + processors), le tsconfig (alias
# @/*) et le runner. On écrase le node_modules tracé (web only) par le complet.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/worker-runner.mjs ./worker-runner.mjs

# Migrations + script one-shot (scripts/migrate.mjs require drizzle-orm + pg).
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts ./scripts

USER node
EXPOSE 8080

# Web par défaut (honore PORT=8080). Le service worker override avec
# `node worker-runner.mjs`.
CMD ["node", "server.js"]
