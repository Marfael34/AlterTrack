# Fiche de Suivi - Étape 27 : Développement 100 % local, suppression de Cloudflare

**Date :** 28 Novembre 2026
**Version :** `v1.6.0` (livré dans le commit global avec les étapes 25 à 27)
**Branche :** `DEV`
**Statut :** Fait. Typage et bundle OK. Vérification sur téléphone à faire.

---

## 1. Contexte

> *"Uncaught Error: java.io.IOException: Failed to download remote update"* (Expo Go)
> *"repars de zeros je veux uniquement du local enlève le cloudflare"*
> *"je veux que tout marche avec une seul commande"*
> *"la commande que je demander tout a l'heure était unique le commande pour lancer expo sans bug depuis ./apps/mobile"* (les conteneurs Docker sont déjà lancés)

## 2. Causes de l'erreur Expo Go

- **WSL en mode réseau NAT** (`172.22.92.63`) : Metro (8081) et l'API (3000) ne sont pas joignables depuis le téléphone.
- **VPN actif sur le téléphone** : il bloque l'accès au réseau local.
- **URL d'API de dev périmée** : `apps/mobile/.env` pointait vers un tunnel `trycloudflare.com` expiré.

## 3. Décision

Le développement se fait **uniquement en local**, avec le téléphone sur le même Wi-Fi que le PC, et Expo se lance avec **une seule commande : `npm start` dans `apps/mobile`**. Cloudflare Tunnel et le mode `--tunnel` d'Expo (ngrok) sont supprimés. La production (Render) ne change pas.

## 4. Réalisations

### 4.1 Suppression de Cloudflare et des tunnels

| Élément | Action |
|---------|--------|
| `scripts/tunnel.js`, `scripts/tunnel-watchdog.js` | Supprimés |
| `docker-compose.yml` | Service `tunnel` (`cloudflare/cloudflared`) supprimé |
| `package.json` (racine) | Scripts `tunnel`, `tunnel:watch` et `mobile:tunnel` supprimés. `docker:up` devient `docker compose up -d` |
| `apps/mobile/package.json` | Scripts `tunnel` et `mobile:tunnel` supprimés, dépendance `@expo/ngrok` retirée. Le lockfile est synchronisé (`npm install --package-lock-only`) |
| `apps/mobile/src/constants/tunnelUrl.json` | Supprimé |
| `storage.service.ts` | Plus d'URL de tunnel |
| `HomeScreen.tsx` | Suppression du repli automatique sur le tunnel en cas d'erreur. Il écrasait l'URL enregistrée. « Reconnecter » relance simplement le chargement |
| `SettingsScreen.tsx`, `ServerConfigModal.tsx` | Bouton « Tunnel 4G/5G », encart « Tunnel Cloudflare » et exemple `trycloudflare.com` supprimés |
| Docs de déploiement, `.env.example` | Mentions du tunnel retirées |

Les anciennes URL `trycloudflare.com` encore enregistrées sur un téléphone sont **ignorées**, en dev comme en production. Sans cette protection, une URL de tunnel expirée enregistrée passerait avant Render et bloquerait l'app.

Le CDN de secours de la carte Leaflet (`cdnjs.cloudflare.com`, dans `CompanyMapView.tsx`) n'a rien à voir avec le tunnel. Il est conservé.

### 4.2 URL de l'API en développement

`storage.service.ts`, ordre de résolution en dev :
1. `EXPO_PUBLIC_API_URL` (`.env`, IP Wi-Fi du PC) ;
2. URL saisie dans l'app ;
3. IP du PC déduite de Metro.

Le raccourci « Wi-Fi local (PC) » des réglages utilise l'IP déduite de Metro, à la place de `192.168.1.27`, qui était codée en dur et périmée.

### 4.3 Une seule commande : `npm start` (dans `apps/mobile`)

L'API et PostgreSQL de dev tournent dans **Docker Desktop** (`altertrack-api`, `altertrack-postgres`), lancés par l'utilisateur. Le port 3000 est publié directement sur Windows. Seul Metro (8081) tourne dans WSL. La commande ne gère pas Docker.

`scripts/dev-local.sh`, appelé par `npm start` dans `apps/mobile` et par `npm run dev` à la racine :

| Étape | Action |
|-------|--------|
| 1. Réseau | Détecte l'IP Wi-Fi de Windows et l'IP de WSL. Si la redirection de Metro ou la règle de pare-feu manque (premier lancement, ou IP de WSL changée après un redémarrage), ouvre **une fenêtre UAC** et lance `dev-local-windows.ps1` en administrateur, copié dans le TEMP Windows |
| 2. API | Vérifie que `/health` répond. Sinon, affiche un avertissement sans bloquer |
| 3. App | Écrit `EXPO_PUBLIC_API_URL=http://<IP Wi-Fi>:3000` dans `apps/mobile/.env` |
| 4. Metro | Vérifie que le port 8081 est libre, puis lance `expo start --lan -c` avec l'IP Wi-Fi dans le QR code |

`scripts/dev-local-windows.ps1` (administrateur, appelé par l'étape 1) :
- redirige **8081** (Metro) vers l'IP de WSL. Le port 3000 n'est **pas** redirigé, car Docker l'occupe déjà sur Windows ; une ancienne redirection de 3000 est supprimée ;
- crée une règle de pare-feu pour 3000 et 8081, limitée au **sous-réseau local**, parce que le Wi-Fi est en profil « Public » ;
- `-Remove` retire tout.

Les commandes PowerShell sont passées en `-EncodedCommand`, ce qui évite les problèmes de guillemets entre bash et PowerShell. Les barres de progression sont désactivées, sinon le terminal se remplit de CLIXML.

## 5. Contrôles

| Contrôle | Résultat |
|----------|----------|
| `npx tsc --noEmit` (mobile) | ✅ |
| `npx expo export -p web` | ✅ |
| `bash -n scripts/dev-local.sh` | ✅ |
| Analyse syntaxique PowerShell de `dev-local-windows.ps1` | ✅ |
| `docker-compose.yml` (lecture YAML) | ✅ |
| Étape 1 en lecture seule (IP Wi-Fi `192.168.1.26`, IP WSL, état réseau, TEMP Windows, Docker) | ✅ |
| `docker.exe compose build api` (code actuel) | ✅ image `altertrack-api:latest` reconstruite |
| Réseau après le premier lancement par l'utilisateur | ✅ 8081 redirigé vers WSL (`172.22.92.63`), règle de pare-feu présente |
| Requête SQL du lot 2 sur la base PostgreSQL Docker | ✅ |
| Recherche « cloudflare / tunnel / ngrok » hors `node_modules` et fiches | ✅ seuls restent le filtre des anciennes URL et le CDN Leaflet |

**Non exécutés :**
- `npm start` de bout en bout : il peut ouvrir une fenêtre UAC qui modifie le pare-feu Windows, et Metro est interactif ;
- chargement de l'app sur le téléphone.

## 6. Mode d'emploi

```bash
cd apps/mobile
npm start
```

1. Si une fenêtre d'autorisation Windows s'ouvre, cliquer sur **Oui**. Ça n'arrive qu'au premier lancement ou après un redémarrage.
2. Sur le téléphone : même Wi-Fi que le PC, **VPN coupé**. Scanner le QR code (`exp://192.168.1.26:8081`).

L'API se gère à part (`docker compose up -d --build` après une modification de l'API).

## 7. Points d'attention

- Plus aucun accès possible en 4G/5G ou depuis un autre réseau en dev. C'est le choix retenu.
- L'API de dev tourne en mode production dans Docker : pas de rechargement à chaud. Après une modification de l'API : `docker compose up -d --build`.
- `npm start` dans `apps/mobile` ne lance plus un simple `expo start`. Le lancement brut reste possible avec `npx expo start`.
- Pour ne plus avoir de fenêtre UAC après les redémarrages, on peut passer WSL en mode réseau `mirrored` (`.wslconfig`). Ce n'est pas fait : il faut redémarrer WSL.

## 8. Proposition de commit

Les étapes 25, 26 et 27 sont livrées dans un seul commit :

```bash
git add -A && git commit -m "v1.6.0 feat: derniers événements sur les cartes, retour par geste (React Navigation), dev Expo 100 % local en une commande et suppression de Cloudflare" && git tag v1.6.0 && git push && git push --tags
```
