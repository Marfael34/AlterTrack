# 🚀 Guide de Déploiement Netlify — AlterTrack Web

Ce guide vous accompagne pas à pas pour déployer l'application web **AlterTrack** sur **Netlify** en quelques clics.

---

## 📋 Architecture & Fonctionnement sur Netlify

* **Application Web Frontend (Expo / React Native Web) :** Déployée et distribuée mondialement sur le CDN haute performance de Netlify avec certificat SSL HTTPS automatique gratuit.
* **Backend API (NestJS + PostgreSQL) :** Tourne sur votre serveur (Docker, PC local via Tunnel/DuckDNS, VPS, Render ou Railway). L'application web communique directement avec cette API via requêtes HTTPS sécurisées avec CORS activé.

---

## ⚙️ Fichiers de Configuration Inclus dans le Projet

Le projet intègre déjà toute la configuration nécessaire pour un déploiement sans accroc :

1. **`netlify.toml` (Racine du dépôt) :** Détecté automatiquement par Netlify lors de la connexion du repo GitHub.
2. **`apps/mobile/netlify.toml` :** Pris en compte si vous définissez le *Base directory* sur `apps/mobile`.
3. **`apps/mobile/public/_redirects` :** Garantit le bon fonctionnement du routage Single Page Application (SPA), évitant toute erreur 404 lors des rafraîchissements de page (`/* -> /index.html 200`).
4. **Scripts npm dans `package.json` :** `npm run build` et `npm run build:web` préconfigurés.

---

## 🛠️ Déploiement en 3 étapes sur Netlify

### Étape 1 : Importer le dépôt sur Netlify

1. Connectez-vous à votre compte sur [app.netlify.com](https://app.netlify.com).
2. Cliquez sur **"Add new site"** puis sur **"Import an existing project"**.
3. Sélectionnez **GitHub** et choisissez le dépôt **AlterTrack**.

### Étape 2 : Vérifier les paramètres de Build

Grâce au fichier `netlify.toml`, Netlify pré-remplit automatiquement ces options :

* **Base directory :** `apps/mobile` *(ou vide si vous importez la racine)*
* **Build command :** `npm run build:web`
* **Publish directory :** `dist` *(si base est `apps/mobile`)* ou `apps/mobile/dist` *(si base est vide)*
* **Node.js Version :** `20`

### Étape 3 : Configurer les Variables d'Environnement

Dans les paramètres de votre site Netlify (**Site configuration** > **Environment variables**), ajoutez les variables suivantes :

| Variable | Description | Exemple |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | URL HTTPS publique de votre backend AlterTrack | `https://altertrack.duckdns.org` ou `https://api.altertrack.org` |
| `EXPO_PUBLIC_API_KEY` | Clé secrète d'API (doit être identique à celle du backend) | `altertrack_dev_secret_key_2026_super_safe` |
| `EXPO_PUBLIC_USE_RN_FETCH` | Optimisation upload FormData React Native | `1` |

> 💡 **Astuce Réglages :** Même si vous ne renseignez pas `EXPO_PUBLIC_API_URL` à la compilation, vous pouvez à tout moment renseigner ou modifier l'adresse de votre serveur directement depuis l'écran **Paramètres** de l'application web.

Cliquez ensuite sur **"Deploy site"**. Netlify va compiler l'application en quelques secondes et vous attribuer une URL (ex: `https://altertrack-preview.netlify.app`).

---

## 💻 Déploiement alternatif via CLI (en ligne de commande)

Si vous préférez déployer directement depuis votre terminal sans connecter GitHub :

```bash
# 1. Compiler l'exportation web statique
npm run build

# 2. Déployer sur Netlify (installe temporairement netlify-cli)
npx netlify deploy --dir=apps/mobile/dist --prod
```

---

## 🔒 Sécurité et En-têtes HTTP

Le fichier `netlify.toml` applique automatiquement :
- `X-Frame-Options: DENY` (protection anti-clickjacking)
- `X-Content-Type-Options: nosniff` (protection injection MIME)
- `Referrer-Policy: strict-origin-when-cross-origin`
- Mise en cache immuable 1 an (`max-age=31536000, immutable`) pour tous les bundles JS/CSS et polices Expo sous `/_expo/static/*`.

---

## 🔍 Vérification & Test après déploiement

1. Ouvrez l'URL Netlify de votre site.
2. Connectez-vous avec vos identifiants AlterTrack.
3. Rendez-vous dans **Paramètres** : vérifiez que l'URL du serveur et la clé d'API sont opérationnelles.
4. Vos candidatures, cartes interactives et filtres s'affichent instantanément !
