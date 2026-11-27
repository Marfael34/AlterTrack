# Fiche de Suivi - Étape 24 : Migrations Prisma fiabilisées en production

**Date :** 27 Novembre 2026
**Version :** `v1.4.1` (PATCH : correction de bug)
**Branche :** `DEV`
**Statut :** Corrigé, à déployer sur Render

---

## 1. Contexte

> *"j'ai mis en prod et je n'est plus accés a la database"*

Après le déploiement de la v1.4.0, `/health` répondait `database: ok`, mais `POST /auth/login` renvoyait une erreur 500, y compris pour un compte inexistant.

## 2. Cause

- La v1.4.0 ajoute les colonnes `User.cvFileSize` et `User.cvUploadedAt` (migration `20261127120000_add_cv_upload_metadata`), lues à chaque authentification.
- Le script d'entrée Docker lançait `npx prisma migrate deploy || true`. À cause du `|| true`, l'API démarrait même quand la migration échouait. Les colonnes manquaient alors et chaque requête sur `User` plantait.
- Une nouvelle tentative de `migrate deploy` a échoué avec `P1002` : délai dépassé en attendant le verrou consultatif `pg_advisory_lock`. Ce verrou n'est pas disponible à travers le pooler PgBouncer de Neon (hôte `-pooler`). Il peut aussi être déjà pris par une autre exécution de migration en cours.

## 3. Rétablissement de la production

- Vérification sur la base Neon : `prisma migrate status` répond « Database schema is up to date! ». Les deux colonnes existent et la migration est enregistrée comme terminée : une des tentatives a fini par passer.
- `POST /auth/login` avec un compte inexistant répond de nouveau 401 au lieu de 500.

## 4. Corrections

- `apps/api/prisma/schema.prisma` : ajout de `directUrl = env("DIRECT_URL")`. L'API continue d'utiliser `DATABASE_URL`, qui peut être l'URL « pooler ». Les migrations passent par la connexion directe.
- `apps/api/Dockerfile` (script d'entrée) :
  - `DIRECT_URL` prend la valeur de `DATABASE_URL` s'il n'est pas défini. Docker Compose local continue donc de fonctionner sans changement.
  - `|| true` est supprimé. Le script fait 3 tentatives, à 10 s d'intervalle. Après 3 échecs, le conteneur s'arrête sans démarrer l'API : Render garde l'ancienne version en ligne au lieu de publier une API incompatible avec la base.
- `apps/api/.env.example` et `.env.example` : documentation de `DIRECT_URL`.
- `apps/api/.env` (non versionné) : ajout de `DIRECT_URL=${DATABASE_URL}`, nécessaire aux commandes `prisma` en local.

## 5. Vérifications

- `npx prisma validate` : OK.
- `npx prisma generate` puis `npx tsc --noEmit` (API) : OK.
- `npx jest` (API) : 79/79 tests.
- `sh -n` sur le script d'entrée extrait du Dockerfile : syntaxe OK.
- `prisma migrate status` sur la base Neon avec la nouvelle configuration : « Database schema is up to date! ».
- Le client Prisma se connecte à Neon sans `DIRECT_URL` défini (`SELECT 1` OK).
- Non exécuté : build de l'image Docker et déploiement sur Render.

## 6. Actions manuelles

1. **Changer le mot de passe Neon** de `neondb_owner` : il a été partagé en clair pendant le diagnostic. Ensuite, mettre à jour `DATABASE_URL` sur Render et dans les `.env` locaux.
2. **Variables Render** (facultatif, recommandé) :
   - `DATABASE_URL` = URL Neon avec `-pooler` (connexions de l'API) ;
   - `DIRECT_URL` = même URL sans `-pooler` (migrations).
   Sans `DIRECT_URL`, les migrations utilisent `DATABASE_URL`. Ça fonctionne tant que cette URL n'est pas celle du pooler.
3. `apps/api/.env` en local pointe vers une base Render (`dpg-…frankfurt-postgres.render.com`) qui coupe la connexion (`P1017`). Il faut vérifier si cette base existe encore.

## 7. Proposition de commit

```bash
git add . && git commit -m "v1.4.1 fix: migrations Prisma via connexion directe (directUrl) et arrêt du démarrage si une migration échoue" && git tag v1.4.1 && git push && git push --tags
```
