# Fiche de Suivi - Étape 23 : Lot 1 du cahier des charges — Import du CV et délai d'appel à J+7

**Date :** 27 Novembre 2026
**Version :** `v1.4.0` (MINOR : correctif + évolution métier)
**Branche :** `DEV`
**Référence :** `cahier-des-charges-altertrack_maj.md`, évolutions #1 et #5
**Statut :** Développé et testé automatiquement. Recette sur téléphone et déploiement Render à faire.

---

## 1. Objectifs

- **#1** : l'import du CV fonctionne, le CV reste disponible, on peut le voir, le remplacer et le supprimer.
- **#5** : une candidature sans réponse passe à « À appeler » au bout de 7 jours au lieu d'environ 2 semaines.

## 2. Décisions prises avec l'utilisateur

| Sujet | Décision |
|-------|----------|
| Stockage du CV | Le fichier reste sur le disque du serveur, son chemin reste en base (architecture inchangée). |
| Nouveau cycle de relance | « À appeler » 7 jours après le dernier contact (premier mail, ou relance manuelle si elle a eu lieu). |
| Relance e-mail automatique (ancien J+8) | Supprimée. La relance manuelle reste possible depuis la fiche entreprise. |

## 3. Diagnostic de l'import du CV

1. **Aucun bouton d'import dans le Profil.** Depuis la refonte des paramètres (v1.1.6–v1.1.7), le seul moyen d'importer un CV était le bouton caché dans l'aperçu d'un e-mail. Le Profil affichait « Aucun CV enregistré » sans action possible et ne proposait pas de « Remplacer ».
2. **CV « fantôme » après redémarrage du serveur.** Sur Render (offre sans disque persistant), le disque est vidé à chaque redéploiement ou réveil. La base gardait le chemin : l'app affichait « CV Prêt », mais l'aperçu renvoyait 404 et les e-mails partaient sans pièce jointe.
3. **Validation trop permissive.** N'importe quel fichier nommé `.pdf` était accepté, même sans contenu PDF.
4. **Perte du CV en cas d'échec.** L'ancien fichier était supprimé *avant* l'écriture du nouveau.
5. **Messages en anglais.** Un fichier trop lourd renvoyait « File too large ».
6. **Cache local inutile.** L'app enregistrait l'URI temporaire du cache du sélecteur, qui n'était jamais relue.

## 4. Réalisations techniques

### 4.1 API (`apps/api`)

- **Prisma** : colonnes `User.cvFileSize` et `User.cvUploadedAt` (migration additive `20261127120000_add_cv_upload_metadata`, appliquée au démarrage par `prisma migrate deploy` dans le Dockerfile).
- **`app-config.service.ts`** :
  - le contenu doit commencer par `%PDF-` (le nom et le MIME ne sont plus suffisants) ;
  - écriture dans un fichier `.part` puis renommage ; la base est mise à jour dans une transaction ; si la base échoue, le nouveau fichier est supprimé et l'ancien CV reste actif ;
  - l'ancien fichier n'est supprimé qu'après un enregistrement réussi ; le CV global (miroir utilisé par l'envoi automatique) n'est supprimé que si aucun compte ne l'utilise ;
  - `resolveStoredFile()` vérifie à la fois l'existence du fichier et qu'il est bien dans `uploads/`.
- **`cv-upload-exception.filter.ts`** : renvoie « Le fichier dépasse 10 Mo. » (413) à la place du message Multer.
- **`GET /config` et `/auth/me`** : `hasCv` n'est vrai que si le fichier existe vraiment, et renvoie `cvFileSize` et `cvUploadedAt`.
- **`scheduler/follow-up.constants.ts`** : `CALL_FOLLOW_UP_DELAY_DAYS = 7`, seule source du délai.
- **`scheduler.service.ts`** : la relance e-mail J+8 est supprimée. Le cron de 9 h fait passer à `TO_CALL` (avec notification push) toute candidature `WAITING_FOR_REPLY` dont le dernier contact date d'au moins 7 jours. Les entreprises laissées en `TO_FOLLOW_UP` par l'ancien cycle (sans relance envoyée) sont reprises de la même façon.
- **`mailing.service.ts`** : `followUpReadyAt` (« Relance prévue le ») est calculé avec la constante, y compris après une relance manuelle.

### 4.2 Mobile (`apps/mobile`)

- **`services/cv.service.ts`** : ouvre le sélecteur de documents natif (stockage local, Google Drive, iCloud Drive selon le système), copie le fichier dans le cache de l'app et vérifie le format et la taille (10 Mo) avant l'envoi.
- **`hooks/useCvImport.ts`** : gère tout le parcours d'import, partagé par le Profil et l'aperçu des e-mails :

  | Cas | Comportement |
  |-----|--------------|
  | Import annulé | Aucun message |
  | Format non pris en charge | Message « Format non pris en charge. Importez un fichier PDF. » |
  | Fichier trop lourd | Message « Le fichier dépasse 10 Mo. » |
  | Sélecteur inaccessible | Message et bouton « Ouvrir les réglages » |
  | Échec de l'envoi | Message et bouton « Réessayer », sans re-sélectionner le fichier |

- **`ProfileScreen.tsx`** :
  - boutons « Importer mon CV », « Aperçu PDF », « Remplacer » et « Supprimer » ;
  - affiche le nom du fichier, la date d'import et la taille ;
  - libellés d'accessibilité sur les boutons.
- **`constants/followUp.ts`** : textes « J+15 » remplacés par `J+{CALL_FOLLOW_UP_DELAY_DAYS}` (carte entreprise, bannière de l'accueil, paramètres) ; « Relance J+15 » remplacé par « Relance » dans l'aperçu mail.
- Déconnexion : efface aussi l'ancien cache local du CV.
- `app.json` : version `1.4.0`.

## 5. Contrôles exécutés

| Contrôle | Commande | Résultat |
|----------|----------|----------|
| Typage API | `cd apps/api && npx tsc --noEmit` | ✅ 0 erreur |
| Tests API | `cd apps/api && npx jest` | ✅ 79/79 (11 suites), dont 7 nouveaux tests du stockage du CV et 4 tests du nouveau cycle |
| Build API | `cd apps/api && npm run build` | ✅ |
| Lint API (fichiers modifiés) | `npx eslint <fichiers>` | ✅ aucune nouvelle erreur. Les erreurs `no-unsafe-*` existaient déjà dans `mailing.service.ts` (38) et `jwt-auth.guard.ts` (12) |
| Schéma Prisma | `npx prisma validate` | ✅ |
| Typage mobile | `cd apps/mobile && npx tsc --noEmit` | ✅ 0 erreur |
| Bundle web | `npx expo export -p web` | ✅ |

**Non exécutés :**
- lint mobile : aucune configuration ESLint dans `apps/mobile`, et `npx expo lint` l'aurait créée ;
- migration sur une vraie base ;
- tests sur un vrai téléphone Android ou iOS.

## 6. Recette manuelle à faire

1. Profil → « Importer mon CV » avec un PDF d'environ 2 Mo : nom, date et taille affichés, « Aperçu PDF » l'ouvre.
2. Fermer et relancer l'app : le CV est toujours affiché.
3. Choisir une image ou un fichier `.docx` : message de format. Choisir un PDF de plus de 10 Mo : message de taille. Annuler le sélecteur : aucun message.
4. Couper le réseau pendant l'envoi : message et bouton « Réessayer ».
5. « Remplacer » puis « Supprimer ».
6. Relance : après déploiement, appeler `POST /scheduler/trigger-transitions` (ou attendre le cron de 9 h) et vérifier que les entreprises dont le dernier mail date de plus de 7 jours passent à « À appeler ».

## 7. Risques et points à suivre

- ⚠️ **Durabilité du CV sur Render** : avec un disque non persistant, le CV disparaît encore à chaque redéploiement ou mise en veille. La différence : l'app affiche maintenant « Aucun CV importé » et propose de le ré-importer, au lieu d'un faux « CV Prêt ». Pour que le CV soit vraiment durable avec cette architecture (fichier + lien en base), il faut ajouter un **Persistent Disk** Render (offre payante), monté sur `UPLOAD_DIR`.
- **Changement de comportement** : plus aucune relance par e-mail n'est envoyée automatiquement. Au premier cron après le déploiement, toutes les candidatures sans réponse depuis 7 jours ou plus passent d'un coup à « À appeler » et déclenchent une notification chacune.
- **iCloud Drive** sur iOS : selon la version, la configuration `usesIcloudStorage` du plugin `expo-document-picker` peut être nécessaire. Ce n'est pas configuré, car seul l'APK Android est construit aujourd'hui.
- Préexistant, non traité : le lien d'aperçu du CV transporte le jeton JWT dans l'URL (`?token=`).
- EF-5.5 (délai réglable dans les paramètres) : optionnel, non réalisé.

## 8. Suite du planning

- **Lot 2** : derniers événements de l'historique sur la carte entreprise (#2).
- **Lot 3** : retour par geste (#3). La navigation actuelle est faite maison (`App.tsx`), sans React Navigation.
- **Lot 4** : icône de l'app (#4), après livraison des visuels.

## 9. Proposition de commit

```bash
git add . && git commit -m "v1.4.0 feat: import du CV fiabilisé (profil, erreurs, réessai) et passage à « À appeler » à J+7" && git tag v1.4.0 && git push && git push --tags
```
