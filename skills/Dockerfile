# syntax=docker/dockerfile:1

# --- deps : installe toutes les dépendances (build a besoin des devDeps) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

# --- build : compile l'app Astro en SSR Node standalone ---
FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- prod-deps : node_modules de production uniquement (pour le one-shot migrate) ---
FROM node:22-alpine AS proddeps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# --- runner : image finale slim ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

RUN addgroup -S app && adduser -S app -G app

# Sortie Astro standalone : entry.mjs + client/.
COPY --from=build --chown=app:app /app/dist ./dist
# Le bundle Astro Node embarque l'app — node_modules requis pour les deps non-bundlées
# (postgres, jszip, resend, drizzle-orm…). On reprend prod-deps slim.
COPY --from=proddeps --chown=app:app /app/node_modules ./node_modules
# Skills (source de vérité) — lus à chaud par /api/skills/[name]/download.
COPY --from=build --chown=app:app /app/skills ./skills
# Migrations + scripts + package.json (pour le one-shot migrate).
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/package.json ./package.json

USER app
EXPOSE 8080

CMD ["node", "./dist/server/entry.mjs"]
