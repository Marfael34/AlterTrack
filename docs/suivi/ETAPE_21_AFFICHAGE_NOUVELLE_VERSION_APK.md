# Fiche de Suivi - Étape 21 : Affichage des nouvelles versions de l'APK (page de téléchargement et app)

**Date :** 27 Novembre 2026
**Version :** `v1.3.0` (MINOR : nouvelle fonctionnalité)
**Branche :** `DEV`
**Statut :** Implémenté et testé (API), à valider sur téléphone après le prochain tag

---

## 1. Contexte

> *"Sur la page pour télécharger le .apk fait en sorte que quand une nouvelle version est publier se soit afficher sur sur le site et de même dans l'app"*

La page de téléchargement affichait toujours « v1.0.0 » (valeur codée en dur), alors que la dernière release GitHub était `v1.2.2`. L'APK lui-même se déclarait aussi en `1.0.0`, car `app.json` n'était jamais mis à jour.

## 2. Fonctionnement

Chaque tag `v*` déclenche le workflow `build-apk.yml`, qui publie une release GitHub contenant l'APK. Cette release devient la source de vérité :

1. **API** (`DownloadService.getLatestRelease`) : lit `https://api.github.com/repos/Marfael34/AlterTrack/releases/latest`. Le résultat est mis en cache 10 minutes. Si GitHub est injoignable, l'API garde la dernière valeur connue et réessaie après 1 minute.
2. **Page de téléchargement** (`/` et `/download`) : affiche la version, la date de publication, la taille réelle et le lien direct de l'APK de la dernière release, ainsi qu'un bloc « Nouveautés de la version X » (notes de la release et lien vers l'historique).
3. **`/api/apk-info`** : renvoie en plus `releaseUrl`, `releaseNotes` et `publishedAt`.
4. **App Android** (`UpdateBanner`) : au démarrage et à chaque retour au premier plan (au plus toutes les 30 min), l'app compare sa version installée (`Constants.expoConfig.version`) à celle de `/api/apk-info`. Si une version plus récente existe, un bandeau propose « Télécharger » ou « Plus tard ». « Plus tard » masque le bandeau jusqu'à la version suivante. Le bandeau est désactivé sur le site web (toujours à jour) et dans Expo Go.
5. **Workflow** : une nouvelle étape reprend la version du tag dans `app.json` avant le build (`v1.3.0` donne la version `1.3.0` et le versionCode `10300`).
6. **Version affichée dans l'app** : les écrans Paramètres et Profil lisent `Constants.expoConfig.version`. Dans l'APK, c'est la version du tag (étape du workflow). Pour le site Netlify et Expo Go, `app.json` est passé de `1.0.0` à `1.3.0` et doit suivre la version à chaque release. La mention « Auto-hébergé » du pied de page des Paramètres a été retirée (l'API est hébergée sur Render et la base sur Neon).
7. **Import de tableur dans Expo Go** : `uploadAsync` ne peut pas lire le cache du DocumentPicker dans Expo Go (« isn't readable »), et le secours en `Blob` échouait sur Android. Sur mobile, le secours envoie désormais le fichier au format natif `{ uri, name, type }`. Le message d'erreur inclut aussi la cause de l'échec natif.
8. **Nom de l'APK** : le fichier publié dans la release est renommé `AlterTrack-v1.3.0.apk` (au lieu de `app-release.apk`). C'est ce nom qu'obtient l'utilisateur au téléchargement, et la page l'affiche dans le guide d'installation.

## 3. Fichiers modifiés

- `apps/api/src/modules/download/download.service.ts` : `getLatestRelease()` et `getResolvedApkInfo()`, `getLandingHtml()` devient asynchrone.
- `apps/api/src/modules/download/download.controller.ts` : routes asynchrones basées sur la release GitHub.
- `apps/api/src/modules/download/download.template.ts` : bloc « Nouveautés » et date de publication dans le badge.
- `apps/api/src/modules/download/*.spec.ts` : tests adaptés, plus deux nouveaux tests (release GitHub et cache ; repli si GitHub est injoignable).
- `apps/mobile/src/components/UpdateBanner.tsx` (nouveau), `apps/mobile/src/utils/version.ts` (nouveau), `apps/mobile/App.tsx`, `apps/mobile/src/services/api.service.ts`.
- `.github/workflows/build-apk.yml` : étape « Set app version from tag ».

## 4. Vérifications

- `npx jest src/modules/download` : 13/13 tests OK.
- `npx tsc --noEmit` (API et mobile) : OK.
- ESLint : aucune nouvelle erreur (les 8 erreurs restantes existaient déjà).

## 5. À noter

- L'APK `v1.2.2` actuellement installé ne contient pas encore le bandeau : il faut installer une fois à la main l'APK `v1.3.0`. Les versions suivantes seront ensuite signalées automatiquement dans l'app.
- Si des notes sont saisies dans la release GitHub, elles s'affichent sur la page de téléchargement.
