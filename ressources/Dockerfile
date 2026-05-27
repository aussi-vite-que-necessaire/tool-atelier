# syntax=docker/dockerfile:1

# --- deps : installe toutes les dépendances (le build a besoin des devDeps) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build : compile l'app Next en sortie standalone ---
# Les secrets/DB sont lus paresseusement au runtime (db/index.ts, lib/auth.ts, lib/email.ts).
# Seule NEXT_PUBLIC_BETTER_AUTH_URL est inlinée au build (client navigateur) → on fige la
# valeur lab. Les autres envs ne servent qu'à laisser passer le build (aucune connexion réelle).
FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_BETTER_AUTH_URL=https://ressources.lab.avqn.ch
ENV NEXT_PUBLIC_BETTER_AUTH_URL=${NEXT_PUBLIC_BETTER_AUTH_URL}
# Placeholders : permettent au build d'aboutir sans vrais secrets ni base.
ENV DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder
ENV BETTER_AUTH_SECRET=build-placeholder-secret-build-placeholder-secret
ENV BETTER_AUTH_URL=https://ressources.lab.avqn.ch
ENV APP_URL=https://ressources.lab.avqn.ch
# Clé de chiffrement des Server Actions — DOIT être identique build + runtime, sinon
# « Failed to find Server Action » en self-hosted. Faible sensibilité (réfs d'action).
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=Uh/a226WHYYubDLev4Kg4PMV+YnbcyyHbaW6rSD+o/U=
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- prod-deps : node_modules de production uniquement (pour le one-shot migrate) ---
FROM node:22-alpine AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- runner : image finale slim ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
# Même clé qu'au build (cohérence des Server Actions).
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=Uh/a226WHYYubDLev4Kg4PMV+YnbcyyHbaW6rSD+o/U=

# Sortie standalone de Next : serveur + node_modules tracés + fichiers du skill
# (next.config.ts : outputFileTracingIncludes pour /api/admin/skill).
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Filet de sécurité : la route /api/admin/skill lit ./skills/creer-une-ressource au runtime
# (process.cwd()) — on garantit sa présence même si le tracing évoluait.
COPY --from=build --chown=node:node /app/skills ./skills

# Migrations + script + deps de prod, pour le conteneur one-shot `migrate`
# (la même image sert au migrate : scripts/migrate.mjs require drizzle-orm + postgres).
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=proddeps --chown=node:node /app/node_modules ./node_modules

USER node
EXPOSE 8080

# Démarre le serveur standalone Next (honore PORT=8080).
CMD ["node", "server.js"]
