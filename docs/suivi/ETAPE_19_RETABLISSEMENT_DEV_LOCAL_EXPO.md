# Fiche de Suivi - Étape 19 : Rétablissement du développement local avec Expo Go

**Date :** 25 Novembre 2026
**Version :** `v1.2.1` (PATCH : correction de bug)
**Branche :** `DEV`
**Statut :** Corrigé, vérification sur téléphone à faire par l'utilisateur

---

## 1. Contexte

> *"pour le dev en local je veux que tu me remette tout normal parce que actuellement quand je veux accéder a mon app depuis expo je ne peux pas charger les données"*

## 2. Causes identifiées

1. **URL du serveur écrasée par Render** (`storage.service.ts`, commit `v1.1.10`) : quand aucune URL n'était enregistrée, `getServerUrl()` écrivait `https://altertrack-api.onrender.com` dans AsyncStorage, même en développement.
2. **IP codée en dur et obsolète** (`api.service.ts`) : en dev, l'URL Render était ignorée et l'app retombait sur `http://192.168.1.102:3000` (Android) ou `http://localhost:3000` (iOS, inaccessible depuis un téléphone). L'IP Wi-Fi actuelle du PC est `192.168.1.26`.
3. **`.env` mobile obsolète** : `EXPO_PUBLIC_API_URL=http://10.250.32.179:3000` (ancien réseau), et cette variable n'était plus lue sur mobile.
4. **Clé API par défaut incorrecte** : la clé utilisée par défaut était `altertrack_dev_secret_key_2026_super_safe` au lieu de `EXPO_PUBLIC_API_KEY`, ce qui provoquait des erreurs 401 si la clé n'avait pas été saisie dans les paramètres.
5. **`limit: 500` refusé par l'API** si le serveur tourne sans la modification `@Max(500)` de `QueryCompanyDto` (étape 18, pas encore commitée).

## 3. Corrections

- `apps/mobile/src/services/storage.service.ts` :
  - En `__DEV__`, l'URL est résolue dans cet ordre : `EXPO_PUBLIC_API_URL` (.env) > URL saisie dans l'app (hors localhost et Render) > IP du PC déduite de Metro (`Constants.expoConfig.hostUri`, port 3000) > tunnel. Rien n'est plus écrit dans le stockage en dev.
  - En production, le comportement ne change pas (URL saisie, sinon Render).
  - Clé API par défaut : `EXPO_PUBLIC_API_KEY`.
- `apps/mobile/src/services/api.service.ts` : `getBaseUrl()` délègue à `StorageService.getServerUrl()` en dev (l'IP codée en dur est supprimée). En production, l'app utilise toujours Render.
- `apps/mobile/.env` (non versionné) : `EXPO_PUBLIC_API_URL=http://192.168.1.26:3000`.

## 4. Vérifications

- `npx tsc --noEmit` (mobile) : OK.
- Non exécuté : test sur un téléphone avec Expo Go (l'API n'était pas démarrée pendant l'intervention).

## 5. Points d'attention

- **WSL2 en mode NAT** : si l'API tourne dans WSL (`npm run api:dev`), le téléphone ne peut pas joindre `192.168.1.26:3000` sans redirection de port Windows (voir ci-dessous). Avec Docker Desktop (`docker compose up`), le port 3000 est déjà publié sur Windows.
  ```powershell
  # PowerShell administrateur (Windows)
  netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=3000 connectaddress=<IP_WSL> connectport=3000
  New-NetFirewallRule -DisplayName "AlterTrack API 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
  ```
  `<IP_WSL>` s'obtient avec `hostname -I` dans WSL. Elle change à chaque redémarrage.
- Si l'IP Wi-Fi du PC change, mettre à jour `EXPO_PUBLIC_API_URL` dans `apps/mobile/.env`, puis relancer `npx expo start -c`.

## 6. Prochaines étapes

- Vérifier le chargement des fiches dans Expo Go.
- Commit/tag `v1.2.0` (étape 18), puis `v1.2.1` (cette étape).
