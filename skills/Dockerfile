# syntax=docker/dockerfile:1

# --- deps : installe toutes les dépendances (build a besoin des devDeps) ---
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

# --- build : compile l'app Astro en SSR Node standalone ---
FROM node:22-slim AS build
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- prod-deps : node_modules de production uniquement (pour le one-shot migrate) ---
FROM node:22-slim AS proddeps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# --- runner : image finale slim ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# debian-slim a déjà un user "node" prêt à l'emploi.

# Sortie Astro standalone : entry.mjs + client/.
COPY --from=build --chown=node:node /app/dist ./dist
# Le bundle Astro Node embarque l'app — node_modules requis pour les deps non-bundlées
# (postgres, jszip, resend, drizzle-orm…). On reprend prod-deps slim.
COPY --from=proddeps --chown=node:node /app/node_modules ./node_modules
# Skills (source de vérité) — lus à chaud par /api/skills/[name]/download.
COPY --from=build --chown=node:node /app/skills ./skills
# Migrations + scripts + package.json (pour le one-shot migrate).
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 8080

CMD ["node", "./dist/server/entry.mjs"]
