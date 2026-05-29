# syntax=docker/dockerfile:1

# --- deps : installe toutes les dépendances (build a besoin des devDeps) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# --- build : compile l'app Next en sortie standalone ---
# Pas besoin de DATABASE_URL ni BETTER_AUTH_SECRET au build (lecture paresseuse au runtime).
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runner : image finale slim ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Utilisateur non-root.
RUN addgroup -S app && adduser -S app -G app

# Sortie standalone de Next : serveur + node_modules tracés (suffisant pour servir ;
# la passerelle n'a ni DB ni migrate, donc pas de drizzle/scripts/prod-deps à embarquer).
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

USER app
EXPOSE 8080

# Démarre le serveur standalone Next.
CMD ["node", "server.js"]
