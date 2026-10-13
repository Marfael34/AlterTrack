# Fiche de Suivi — Étape 1 : Socle Backend & Base de Données

**Projet :** AlterTrack  
**Étape :** 1 / 5 — Socle Backend & Base de données (NestJS, PostgreSQL, Prisma)  
**Date :** 13 Octobre 2026  
**Auteur :** Rafael Martinez & Assistant Antigravity  
**Statut :** ✅ Validé & Terminé  

---

## 1. Objectifs de l'étape

Conformément au [cahier_des_charges_complet.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/cahier_des_charges_complet.md) et aux [Regles.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/Regles.md) :
1. Structurer le dépôt en monorepo propre avec gestionnaire npm workspaces (`apps/*`).
2. Configurer la conteneurisation Docker pour PostgreSQL (`docker-compose.yml`) avec redémarrage automatique et persistance.
3. Définir le schéma déclaratif Prisma (`schema.prisma`) avec les modèles `Company`, `AppConfig` et l'énumération `Status` à 7 états.
4. Mettre en place l'API NestJS (`apps/api`) avec TypeScript en mode strict, validation des variables d'environnement au démarrage (`env.validation.ts`) et sécurité renforcée (Helmet, CORS, ValidationPipe globale).
5. Développer les modules métier :
   - **HealthModule** : route `/health` publique vérifiant l'uptime et la liaison base de données.
   - **CompaniesModule** : CRUD complet des fiches entreprises, recherche textuelle insensible à la casse, filtrage par statut et agrégation statistique.
   - **AppConfigModule** : gestion du modèle de mail de base, stockage sécurisé du CV PDF (avec vérification stricte de frontière et assainissement des noms de fichiers) et enregistrement du push token Expo.
   - **ApiKeyGuard** : sécurisation des endpoints privés par clé d'API statique avec comparaison en temps constant (`crypto.timingSafeEqual`).
6. Valider la qualité par des tests unitaires, tests e2e, vérifications TypeScript et ESLint.

---

## 2. Réalisations techniques

### Structure du projet
- `.gitignore` complet protégeant les secrets, tokens, dépendances et fichiers uploadés.
- `package.json` racine avec configuration npm workspaces et commandes d'orchestration (`api:start`, `api:dev`, `api:test`, `api:lint`, `docker:up`).
- `.env.example` documenté avec toutes les variables obligatoires et facultatives.
- `docker-compose.yml` configuré pour PostgreSQL 16 Alpine avec healthcheck et volume nommé.

### Backend NestJS (`apps/api`)
- **Schéma Prisma** (`apps/api/prisma/schema.prisma`) :
  - `Company` : id, name, email, phone, notes, status, firstMailSentAt, followUpReadyAt, followUpSentAt, lastMailId, timestamps, index sur `status` et `email`.
  - `AppConfig` : id, template, cvFilePath, cvOriginalName, expoPushToken, timestamps.
  - `Status` : `TO_SEND`, `WAITING_FOR_REPLY`, `TO_FOLLOW_UP`, `TO_CALL`, `REPLY_RECEIVED`, `REFUSED`, `ACCEPTED`.
- **Configuration & Sécurité** :
  - `apps/api/src/config/env.validation.ts` : validation au boot via `class-validator` (arrêt immédiat si `DATABASE_URL` ou `API_KEY` absente/invalide).
  - `apps/api/src/common/guards/api-key.guard.ts` : protection contre les attaques de temporisation (*timing attacks*).
  - `apps/api/src/common/filters/http-exception.filter.ts` : masque les erreurs internes de base de données et standardise les réponses d'erreur.
  - `apps/api/src/main.ts` : en-têtes Helmet, CORS, ValidationPipe avec `whitelist: true` et `forbidNonWhitelisted: true`.
- **Services et Contrôleurs** :
  - `HealthController` (`GET /health`)
  - `CompaniesController` (`POST /companies`, `GET /companies`, `GET /companies/stats`, `GET /companies/:id`, `PATCH /companies/:id`, `PATCH /companies/:id/status`, `DELETE /companies/:id`)
  - `AppConfigController` (`GET /config`, `PATCH /config/template`, `PATCH /config/push-token`, `POST /config/cv`, `GET /config/cv/download`)

---

## 3. Contrôles et validations exécutés

| Type de contrôle | Commande | Résultat |
|---|---|---|
| **Compilation TypeScript** | `npm run build` | ✅ 0 erreur de compilation |
| **Linting ESLint** | `npm run lint` | ✅ 0 erreur, 0 avertissement |
| **Tests unitaires** | `npm run test` | ✅ 2 suites passées, 10 tests réussis (CompaniesService, ApiKeyGuard) |
| **Tests end-to-end** | `npm run test:e2e` | ✅ 1 suite passée, 3 tests réussis (/health public, 401 sans clé, 200 avec clé) |

---

## 4. Décisions d'architecture structurantes

1. **Version stable Prisma 6.19.3 :** Utilisation de la version stable Prisma 6 compatible avec Node 20 LTS et architecture PostgreSQL sans nécessiter d'adaptateur expérimental.
2. **Comparaison en temps constant :** Implémentation de `crypto.timingSafeEqual` dans `ApiKeyGuard` pour éviter toute déduction de la clé d'API par mesure de temps de réponse.
3. **Sécurisation stricte du stockage CV :** Validation du type MIME (`application/pdf`), limite de taille (10 Mo), nommage déterministe avec suffixe aléatoire cryptographique et vérification stricte de frontière de répertoire (`uploadBoundary`).

---

## 5. Prochaine étape

* **Étape 2 : Intégration Gemini & Gmail**
  - Mise en place du module Gemini (`@google/genai`) avec prompt d'adaptation de candidature et réponse JSON structurée (`subject`, `body`).
  - Intégration Nodemailer pour l'envoi SMTP (compte Gmail avec mot de passe d'application + pièce jointe CV).
  - Intégration ImapFlow pour la surveillance IMAP des e-mails entrants et transition automatique vers le statut `REPLY_RECEIVED`.
