# Fiche de Suivi - Étape 22 : Lien de l'APK en 404 et version périmée sur la page de téléchargement

**Date :** 27 Novembre 2026
**Version :** `v1.3.1` (PATCH : correction de bug, API uniquement)
**Branche :** `DEV`
**Statut :** Corrigé et testé, redéploiement Render à faire par l'utilisateur

---

## 1. Contexte

> *"quand j'essaie de télécharger l'app sur la page dédié je suis rediriger vers un 404 de github et dans cette même page j'ai le numéros de version n'est pas a jour"*

## 2. Diagnostic

- Le code de l'étape 21 est bien déployé sur Render : `/api/apk-info` renvoie les nouveaux champs `releaseUrl` et `publishedAt`, mais à `null`.
- La lecture de la release via `api.github.com` échoue donc sur Render. L'API retombe alors sur ses anciennes valeurs : la version par défaut `1.0.0` et la variable `APK_DOWNLOAD_URL` (`.../releases/latest/download/app-release.apk`).
- Depuis `v1.3.0`, l'APK de la release s'appelle `AlterTrack-v1.3.0.apk` : `app-release.apk` n'existe plus dans la dernière release, d'où le 404 de GitHub.
- Cause probable de l'échec : l'API GitHub non authentifiée limite à 60 requêtes par heure et par IP, et les IP de sortie de Render sont partagées avec d'autres services.

## 3. Corrections

`apps/api/src/modules/download/download.service.ts` : nouvelle méthode de secours `getLatestReleaseFromRedirect()`, appelée quand l'API GitHub échoue.

1. `HEAD https://github.com/<repo>/releases/latest` redirige vers `/releases/tag/<tag>`, qui donne la version. Cette page n'est pas soumise à la limite de l'API.
2. `HEAD` sur `releases/download/<tag>/AlterTrack-<tag>.apk` confirme que l'APK existe et donne sa taille (`content-length`) et sa date de publication (`last-modified`).
3. Si l'APK n'a pas le nom attendu, le lien pointe vers la page de la release plutôt que vers un 404.

Tests ajoutés dans `download.service.spec.ts` : lecture par redirection, et repli sur la page de la release quand le nom de l'APK est inattendu.

### Page de téléchargement responsive (`download.template.ts`)

Captures faites avec Chrome headless à 360, 768 et 1280 px.

- **Téléphone (≤ 640 px)** : liens de l'en-tête masqués (ils débordaient et sont déjà dans le pied de page), marges réduites, infos de l'APK sur 2 colonnes, bloc QR code masqué (il sert à passer de l'ordinateur au téléphone), bouton de téléchargement compact.
- **Petits téléphones (≤ 380 px)** : badge de version de l'en-tête masqué.
- **Tablette (≤ 900 px)** : les 3 étapes d'installation tiennent sur une seule ligne (avant : 2 + 1 isolée), espacements réduits.
- **Grilles** : `minmax(min(100%, …), 1fr)` pour éviter tout débordement horizontal.
- **Écrans tactiles** : pas d'effet de survol qui décale les cartes.

## 4. Vérifications

- `npx jest src/modules/download` : 15/15 tests OK.
- `npx tsc --noEmit` (API) : OK. ESLint : aucune nouvelle erreur (les 8 restantes existaient déjà).
- La redirection et la requête `HEAD` sur l'APK ont été testées avec le vrai GitHub depuis Node 20 : `v1.3.0`, 81 232 397 octets, publiée le 27/11/2026 à 10:41 UTC.

## 5. À faire côté Render

- Redéployer l'API.
- Variable `APK_DOWNLOAD_URL` : la supprimer, ou la remplacer par `https://github.com/Marfael34/AlterTrack/releases/latest`. Elle ne sert plus qu'en dernier recours, mais pointe aujourd'hui vers un fichier qui n'existe plus.
- Optionnel : ajouter `GITHUB_TOKEN` (token GitHub en lecture seule) pour lever la limite de l'API et récupérer aussi les notes de version.
- Pas de nouvel APK nécessaire : la correction ne concerne que l'API, inutile de poser un tag.
