# Fiche de Suivi - Étape 16 : Page Web de Téléchargement de l'APK Mobile

**Date :** 21 Octobre 2026  
**Branche :** `main`  
**Auteur :** Antigravity AI & Rafael Martinez  
**Statut :** Terminé & Validé  

---

## 1. Contexte & Demande Utilisateur

L'utilisateur a demandé :
> *"créer une page web pour qu'on puisse télécharger le .apk de l'app"*

### Objectifs :
1. **Landing Page Publique & Moderne :** Déployer une page d'accueil web accessible sur `GET /` et `GET /download` pour présenter l'application AlterTrack et permettre son téléchargement.
2. **Design Sombre & Glassmorphism Premium :** Respecter une charte visuelle soignée (fond sombre obsidian, cartes semi-transparentes en verre dépoli, dégradés d'accent bleu et cyan, typographie Google Fonts *Outfit* & *Inter*, micro-animations).
3. **Téléchargement Direct du Binaire :** Permettre le téléchargement immédiat du fichier `.apk` via la route publique `GET /download/apk` avec les bons en-têtes HTTP (`application/vnd.android.package-archive`, `Content-Disposition: attachment; filename="altertrack-v1.0.0.apk"`).
4. **QR Code Interactif :** Afficher un QR Code dynamique permettant à un utilisateur sur ordinateur de scanner la page avec son smartphone Android pour déclencher instantanément le téléchargement sur son téléphone.
5. **Guide d'Installation en 3 Étapes :** Fournir des instructions claires sur la manière d'installer un fichier APK externe sur Android (téléchargement, autorisation des sources inconnues, installation).
6. **API de Métadonnées :** Exposer l'endpoint `GET /api/apk-info` pour vérifier par script ou frontend externe la disponibilité, la taille et la version de l'APK.
7. **Flexibilité & Continuité :** Gérer à la fois les fichiers APK locaux stockés sur le serveur (`/app/uploads/altertrack.apk`) et la redirection transparente vers un build cloud distant (via variable `APK_DOWNLOAD_URL`).

---

## 2. Réalisations Techniques

### A. Template HTML5 / CSS3 / Vanilla JS (`apps/api/src/modules/download/download.template.ts`)
- **Structure Sémantique & SEO :** Balisage HTML5 sémantique, un seul `<h1>`, balises OpenGraph et meta description pour les aperçus de partage de liens sur les réseaux et messageries.
- **Identifiants Uniques :** Chaque élément interactif dispose d'un identifiant unique (`#brand-logo`, `#btn-download-apk`, `#qr-box`, `#btn-copy-link`, `#toast-msg`).
- **Interactions Sans Dépendance :**
  - Génération dynamique du QR code en haute résolution avec synchronisation automatique sur le domaine hôte actif (`window.location.origin`).
  - Bouton de copie du lien direct dans le presse-papiers avec toast d'animation confirmation.
- **Grille de Fonctionnalités :** Présentation des points forts d'AlterTrack (candidature manuelle et automatique à 09:00, e-mails IA Gemini avec CV PDF, carte satellite, timeline d'historique).

### B. Module de Téléchargement NestJS (`apps/api/src/modules/download/`)
1. **[DownloadService](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/download/download.service.ts) :**
   - Détection intelligente du chemin de l'APK dans les dossiers de stockage configurés (`UPLOAD_DIR`, `/app/uploads/`, `./uploads/`, ou chemin personnalisé `APK_FILE_PATH`).
   - Formatage dynamique de la taille du fichier et de la date de dernière modification.
   - Génération du HTML complet via `renderDownloadPage`.
   - Écran de secours informatif si aucun fichier binaire n'est encore uploadé sur le serveur.
2. **[DownloadController](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/download/download.controller.ts) :**
   - Décoré avec `@Public()` pour autoriser l'accès libre à tout internaute sans jeton JWT.
   - `GET /` et `GET /download` : distribution de la page web avec en-têtes `text/html; charset=utf-8`.
   - `GET /download/apk` : streaming binaire du paquet Android avec en-têtes de téléchargement direct ou redirection 302 vers `APK_DOWNLOAD_URL`.
   - `GET /api/apk-info` : réponse JSON structurée pour l'état du binaire.
3. **[DownloadModule](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/download/download.module.ts) :**
   - Enregistrement dans [app.module.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/app.module.ts).

### C. Sécurité & En-têtes HTTP ([main.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/main.ts))
- Adaptation des directives Content Security Policy (CSP) d'Helmet :
  - `styleSrc` : autorise les styles inline et `https://fonts.googleapis.com`.
  - `fontSrc` : autorise `https://fonts.gstatic.com`.
  - `imgSrc` : autorise `data:` et `https://api.qrserver.com`.
  - `scriptSrc` : autorise les scripts légers inline d'interaction (copie du lien).

### D. Binaire Baseline & Docker
- Génération d'un paquet baseline `altertrack.apk` déployé dans le volume partagé Docker `/app/uploads/altertrack.apk`.
- Recompilation et redémarrage du conteneur `altertrack-api` sous Docker Compose.
- Vérification que le tunnel Cloudflare expose automatiquement la page web et le téléchargement à l'extérieur.

---

## 3. Validation & Tests

### A. Tests Unitaires
- [download.service.spec.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/download/download.service.spec.ts) : 5 tests validés.
- [download.controller.spec.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/download/download.controller.spec.ts) : 5 tests validés.
- **Bilan global Jest :** 10 suites de tests passées avec succès, 63 tests unitaires au total, 0 régression.

### B. Tests d'Intégration HTTP (Curl)
```bash
# 1. Vérification de la landing page HTML
curl -I http://localhost:3000/
# -> HTTP/1.1 200 OK
# -> Content-Type: text/html; charset=utf-8

# 2. Vérification du téléchargement direct de l'APK
curl -I http://localhost:3000/download/apk
# -> HTTP/1.1 200 OK
# -> Content-Type: application/vnd.android.package-archive
# -> Content-Disposition: attachment; filename="altertrack-v1.0.0.apk"

# 3. Vérification de l'endpoint de métadonnées
curl -s http://localhost:3000/api/apk-info
# -> {"available":true,"version":"1.0.0","filename":"altertrack-v1.0.0.apk", ...}
```

---

## 4. Instructions pour Déployer un Nouvel APK

Pour remplacer l'APK par une nouvelle version compilée depuis le mobile (ex: via `eas build -p android --profile preview` ou build local) :

1. **Via le conteneur Docker :**
   ```bash
   docker cp chemin/vers/mon-app.apk altertrack-api:/app/uploads/altertrack.apk
   ```
2. **Ou via le dossier local :**
   ```bash
   cp chemin/vers/mon-app.apk uploads/altertrack.apk
   ```
3. **Ou via une URL de build distant (ex: Expo EAS / GitHub) dans le fichier `.env` :**
   ```env
   APK_DOWNLOAD_URL=https://expo.dev/artifacts/eas/.../build.apk
   ```
