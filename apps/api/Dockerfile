# Multi-stage Dockerfile pour AlterTrack API NestJS
# Étape 1 : Construction
FROM node:20-alpine AS builder

WORKDIR /app

# Copie des fichiers de dépendances et de schéma Prisma
COPY package*.json ./
COPY prisma ./prisma/

# Installation de toutes les dépendances et génération Prisma
RUN npm ci
RUN npx prisma generate

# Copie du code source et compilation TypeScript
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# Étape 2 : Image d'exécution de production légère
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Création du répertoire d'upload et permissions
RUN mkdir -p /app/uploads && chown -R node:node /app

# Copie des fichiers package.json et schéma Prisma
COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma/

# Installation uniquement des dépendances de production
RUN npm ci --omit=dev && npm cache clean --force

# Copie du client Prisma généré et du bundle dist depuis l'étape builder
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=node:node /app/dist ./dist

# Script d'entrée pour appliquer les migrations Prisma avant de démarrer l'API
COPY --chown=node:node <<'EOF' /app/entrypoint.sh
#!/bin/sh
set -e
echo "Application des migrations Prisma sur PostgreSQL..."
npx prisma migrate deploy || true
echo "Démarrage de l'API AlterTrack..."
exec node dist/main.js
EOF

RUN chmod +x /app/entrypoint.sh

USER node

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
