# syntax=docker/dockerfile:1

# Image contentos en DEUX variantes construites via `--target` :
#  - target `web`    : serveur Next standalone (port 8080) + one-shot `migrate`.
#  - target `worker` : consumers BullMQ (src/worker/index.ts via tsx).
# Le workflow CI build les deux et push `atelier-contentos-web` + `atelier-contentos-worker`.
# Les stages amont (deps, build, proddeps) sont partagés → le cache buildx les réutilise
# entre les deux targets.

# --- deps : toutes les dépendances (devDeps inclus pour le `next build`) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build : compile Next en sortie standalone ---
# Les placeholders satisfont la validation zod de src/lib/env.ts pendant
# `next build` ; les vraies valeurs sont lues au runtime (env injecté par lab).
# APP_URL n'est pas inliné côté client (lecture runtime) mais on fige tout de
# même la valeur lab par défaut au cas où une route le capturerait au build.
FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG APP_URL=https://contentos.lab.avqn.ch
ENV APP_URL=${APP_URL}
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
    REDIS_URL=redis://localhost:6379 \
    BETTER_AUTH_SECRET=build-placeholder-secret-build-placeholder-secret
# Clé de chiffrement des Server Actions — DOIT être identique build + runtime, sinon
# « Failed to find Server Action » en self-hosted. Faible sensibilité (réfs d'action).
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=ZrqnC0+LuoOYOSt6hNb9QbxgGFK7Taktm7DIPJeEj9U=
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- proddeps : node_modules de production uniquement (tsx inclus, déplacé en deps) ---
# Sert aussi au worker au runtime : tsx exécute src/worker/index.ts via worker-runner.mjs.
FROM node:22-alpine AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- web : image finale du serveur Next (CMD par défaut + one-shot `migrate`) ---
FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
# Même clé qu'au build (cohérence des Server Actions).
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=ZrqnC0+LuoOYOSt6hNb9QbxgGFK7Taktm7DIPJeEj9U=

# Sortie standalone Next : serveur + node_modules tracés (web).
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Migrations + script one-shot (scripts/migrate.mjs require drizzle-orm + pg).
# On écrase le node_modules tracé (web only) par proddeps pour avoir drizzle-orm + pg.
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=proddeps --chown=node:node /app/node_modules ./node_modules

USER node
EXPOSE 8080
CMD ["node", "server.js"]

# --- worker : image finale des consumers BullMQ ---
FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production

# Code TS du worker + tsconfig (alias @/*) + runner mjs.
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/worker-runner.mjs ./worker-runner.mjs

# proddeps inclut tsx (déplacé en dependencies), bullmq, ioredis, drizzle-orm, pg, etc.
COPY --from=proddeps --chown=node:node /app/node_modules ./node_modules

USER node
CMD ["node", "worker-runner.mjs"]
