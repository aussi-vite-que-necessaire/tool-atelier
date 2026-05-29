# syntax=docker/dockerfile:1

# --- deps : installe toutes les dépendances (build a besoin des devDeps) ---
# build-essentials + python3 : filet de sécurité pour les npm postinstall qui
# compileraient une native non préfabriquée (rare avec node:22-slim mais arrive).
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- build : compile l'app Astro en SSR Node standalone ---
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- prod-deps : node_modules de production uniquement (runtime standalone) ---
FROM node:22-slim AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# --- runner : image finale slim ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Sortie Astro standalone : entry.mjs + client/.
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=proddeps --chown=node:node /app/node_modules ./node_modules
# Skills (source de vérité) — lus à chaud par /api/skills/[name]/download.
COPY --from=build --chown=node:node /app/skills ./skills
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 8080

CMD ["node", "./dist/server/entry.mjs"]
