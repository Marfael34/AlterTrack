# Fiche de Suivi - Étape 20 : Migration de la base vers Neon et sessions bloquées en 401

**Date :** 27 Novembre 2026
**Version :** `v1.2.2` (PATCH : correction de bug)
**Branche :** `DEV`
**Statut :** Corrigé, reconnexion et redéploiement Netlify à faire par l'utilisateur

---

## 1. Contexte

> *"j'ai coupé l'ancienne base de donner sur render après avoir récuperer tout les informations sur la base de donne sur neon"*

La base PostgreSQL de production a été déplacée de Render vers Neon. Depuis, le site renvoie des erreurs `401` sur `/companies` et `/companies/cities`.

## 2. Diagnostic

- `GET https://altertrack.onrender.com/health` : `200`, `"database":"ok"`. L'API est bien connectée à Neon.
- `POST /auth/login` avec un compte inexistant : `401` « Adresse e-mail ou mot de passe incorrect ». Les tables existent dans Neon.
- `/companies/cities` : `401` « Accès non autorisé : veuillez vous connecter avec un compte valide ».

**Cause :** le navigateur garde le jeton JWT de l'ancienne session. Le serveur le refuse, soit parce que l'utilisateur ciblé (`sub`) n'existe pas sous le même identifiant dans Neon, soit parce que `JWT_SECRET` a changé sur Render.

**Bug aggravant :** l'app devait se déconnecter automatiquement sur une erreur 401, mais elle cherchait `401` ou `unauthorized` dans le message d'erreur. Or l'API renvoie des messages en français (« Accès non autorisé… »). La déconnexion ne se déclenchait donc jamais et l'utilisateur restait bloqué.

## 3. Corrections

- `apps/mobile/src/services/api.service.ts` : l'erreur levée porte désormais le code HTTP (`error.status`).
- `apps/mobile/src/context/AuthContext.tsx` : la déconnexion automatique se déclenche sur `err.status === 401`.
- `apps/mobile/src/services/storage.service.ts` : `RENDER_PRODUCTION_URL` corrigée (`altertrack-api.onrender.com` n'existe pas ; la bonne URL est `altertrack.onrender.com`).

## 4. Vérifications

- `npx tsc --noEmit` (mobile) : OK.
- À faire : redéployer le site sur Netlify, se reconnecter, vérifier que les entreprises s'affichent.
