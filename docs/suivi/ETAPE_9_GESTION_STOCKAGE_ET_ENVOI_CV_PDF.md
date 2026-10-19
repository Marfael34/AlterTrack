# Fiche de Suivi — Étape 9 : Stockage du CV PDF sur l'App & Envoi Automatique avec les E-mails

**Date :** 19 octobre 2026  
**Auteur :** Antigravity AI Assistant & Rafael Martinez  
**Projet :** AlterTrack — Gestionnaire Intelligent de Candidatures d'Alternance  
**Statut de l'étape :** ✅ TERMINÉE ET VALIDÉE

---

## 1. Objectifs de l'étape

Conformément à la demande de l'utilisateur (*« fait en sorte que je puisse stocker mon CV en .pdf sur l'app et qu'il soit envoyer avec le mail »*) et aux directives de qualité et de sécurité de [Regles.md](../../Regles.md) :

1. **Stockage persistant et synchronisation du CV (.pdf)** :
   - Permettre à l'utilisateur d'importer son CV au format PDF depuis son smartphone ou navigateur.
   - Conserver une copie locale dans l'application (cache local persistant pour fonctionnement hors-ligne / aperçu rapide).
   - Synchroniser le fichier sur le serveur sécurisé de l'API AlterTrack (stockage dans `uploads/cv/` et liaison au compte utilisateur `User` en base PostgreSQL).
2. **Attachement automatique du CV dans tous les envois d'e-mails** :
   - Envoi groupé en 1 clic (`sendInitialBatch`).
   - Envoi unitaire de première candidature (`sendSingle`).
   - Envoi de relance intelligente (`sendFollowUp`).
   - Envoi de test de réception sur boîte personnelle (`sendTestEmail`).
3. **Sécurité et intégrité des fichiers (SecureCoder & Règle 9)** :
   - Validation stricte de l'extension `.pdf` et du type MIME `application/pdf`.
   - Contrôle des octets magiques (*magic bytes*) : vérification que le fichier commence impérativement par `%PDF-` pour prévenir tout téléversement malveillant (CWE-434).
   - Protection contre le Directory Traversal (CWE-22) : sanitisation du nom de fichier, interdiction absolue des séquences `..` et validation avec confinement strict au répertoire `uploads/cv/` (avec vérification du slash de fin).
   - Limite de taille stricte fixée à 10 Mo.
4. **Ergonomie et expérience utilisateur soignées** :
   - Écran **Paramètres** : Carte moderne affichant l'état du CV (fichier présent, taille en Ko, date de synchronisation, statut « Stocké sur l'app & synchronisé »), avec actions directes pour **Visualiser**, **Remplacer** ou **Supprimer**.
   - Modale de prévisualisation e-mail (`EmailPreviewModal`) : Carte récapitulative de la pièce jointe avec mention du CV joint ou invitation avec bouton d'import en 1 clic si manquant.
   - Fiche Entreprise & Vue Accueil : Alerte prévenant l'utilisateur si aucun CV n'est configuré avant d'envoyer un mail ou une vague de candidatures, avec redirection directe vers les paramètres.

---

## 2. Réalisations techniques

### 2.1 Backend NestJS (`apps/api`)

#### Modules `app-config` & `users`
- **`app-config.service.ts`** :
  - `saveCv` : Vérifie la taille (max 10 Mo) et les magic bytes `%PDF-` à la lecture du buffer. Sauvegarde sur disque sous un nom sécurisé `cv_<userId>_<timestamp>_<hash>.pdf`. Met à jour le profil de l'utilisateur (`User.cvFilePath`, `User.cvOriginalName`, `User.cvMimeType`, `User.cvFileSize`) ainsi que la table `AppConfig`.
  - `getCvFileForUser(userId?)` : Résolution robuste et sécurisée du chemin de CV actif (vérification de l'existence physique du fichier via `fs.existsSync` avec fallback sur `AppConfig`).
  - `deleteCv(userId?)` : Suppression sécurisée du fichier sur disque et réinitialisation des champs en base de données.
- **`app-config.controller.ts`** :
  - `GET /config` : Retourne l'état `hasCv: boolean` et `cvOriginalName: string | null` contextualisé pour l'utilisateur authentifié.
  - `POST /config/cv` : Endpoint d'upload multipart avec filtre Multer permissif pour Android, validation par magic bytes `%PDF-`, stockage sécurisé et réponse JSON enrichie.
  - `GET /config/cv/download` : Endpoint de téléchargement/visualisation sécurisé en flux streaming (`inline; filename="..."`, `Content-Type: application/pdf`, `X-Content-Type-Options: nosniff`).
  - `DELETE /config/cv` : Endpoint de suppression du CV.
- **`jwt-auth.guard.ts`** :
  - Support de l'authentification par token JWT ou clé API via les paramètres de requête (`?token=...`, `?apiKey=...`). Cela permet l'ouverture et la prévisualisation directe du PDF dans le navigateur externe ou la visionneuse système (via `Linking.openURL`) sans lever d'erreur HTTP 401 Unauthorized.

#### Module `mailing`
- **`email.service.ts`** :
  - Mise à jour du type `SendMailOptions` pour supporter `attachmentPath` et `attachmentName`.
  - Intégration dans Nodemailer :
    ```typescript
    if (options.attachmentPath && fs.existsSync(options.attachmentPath)) {
      mailOptions.attachments = [
        {
          filename: options.attachmentName || 'CV.pdf',
          path: options.attachmentPath,
          contentType: 'application/pdf',
        },
      ];
    }
    ```
  - Journalisation explicite `[PIÈCE JOINTE CV]` lors de l'expédition réussie.
- **`mailing.service.ts`** :
  - Implémentation du helper `resolveCvAttachment(userId, currentUser)` : résout le chemin physique et le nom d'affichage du CV.
  - Injection systématique de la pièce jointe dans :
    - `sendInitialBatch` (incluant le rapport `cvAttached` et `cvName` en réponse API).
    - `sendSingle` (reçoit également `subject` et `body` personnalisés, renvoie `hasAttachment` et `attachmentName`).
    - `sendFollowUp` (relance avec CV re-joint).
    - `sendTestEmail` (permet de vérifier la réception du PDF sur sa boîte personnelle).

---

### 2.2 Application Mobile React Native (`apps/mobile`)

#### Services
- **`storage.service.ts`** :
  - Définition de l'interface `LocalCvInfo` (nom, taille, mimeType, localUri, date d'enregistrement).
  - Méthodes `getLocalCv()`, `setLocalCv()` et `removeLocalCv()`.
- **`api.service.ts`** :
  - **Résolution de l'erreur `Unsupported FormDataPart implementation`** :
    - Sur React Native moderne / Expo SDK 57 (utilisant le moteur WinterCG `expo/fetch`), les objets de fichier JS `{ uri, name, type }` sont rejetés par le sérialiseur FormData standard.
    - Installation et liaison officielle de `expo-file-system`.
    - Implémentation d'une architecture de téléversement multi-stratégies résiliente :
      1. **Streaming natif prioritaire** via `FileSystem.uploadAsync(..., { uploadType: MULTIPART })` : streaming direct via OkHttp (Android) et NSURLSession (iOS) contournant le moteur JS FormData/fetch (zéro surcoût mémoire, vitesse maximale, compatible `content://` et `file://`).
      2. **Stratégie Blob WinterCG** : conversion `fetch(fileUri).blob()` compatible avec l'API Web et Expo modern fetch.
      3. **Stratégie ExpoFile** : utilisation de `new ExpoFile(fileUri)` implémentant l'interface `.bytes()`.
      4. **Stratégie Legacy RN** : fallback d'objet URI pour les moteurs RN classiques.
  - Ajout des méthodes `deleteCv()`, `getCvDownloadUrl()`.
  - Enrichissement des retours typés pour les envois d'e-mails.

#### Écrans & Composants
- **`SettingsScreen.tsx`** :
  - Intégration de l'état local et distant du CV via `useAuth()` et `StorageService`.
  - Carte CV moderne aux normes AlterTrack (fond sombre `#151c2e`, bordure cyan `#00d4ff`, typographie épurée) :
    - Badge vert « Stocké sur l'app & synchronisé ✅ ».
    - Métadonnées complètes : nom original, poids en Ko, extension `.pdf`.
    - Bouton **Voir** : ouverture immédiate dans le navigateur ou visionneuse PDF système via `Linking.openURL(downloadUrl)`.
    - Bouton **Remplacer** : sélection d'un nouveau document PDF avec mise à jour instantanée.
    - Bouton **Supprimer** : alerte de confirmation et suppression conjointe locale et distante.
    - **Gestion des particularités Android** : normalisation automatique du nom du fichier si le gestionnaire de fichiers Android (Google Drive, WhatsApp, Téléchargements) omet l'extension `.pdf` dans le nom d'affichage alors que le MIME type est `application/pdf`.
- **`EmailPreviewModal.tsx`** :
  - Affichage d'un bloc récapitulatif de pièce jointe avec le nom du CV rattaché.
  - Si aucun CV n'est importé : badge d'avertissement jaune avec bouton « Importer » direct qui déclenche le `DocumentPicker` sans avoir à quitter la modale de prévisualisation.
- **`CompanyDetailScreen.tsx`** :
  - Avertissement interactif lors d'un envoi unitaire ou d'une relance si aucun CV n'est détecté.
  - Confirmation mentionnant le nom précis du document PDF joint.
- **`HomeScreen.tsx`** :
  - Contrôle préalable lors du clic sur l'envoi groupé en 1 clic (`handleSendBatch`) : alerte si aucun CV n'est configuré avec proposition d'aller dans les paramètres ou d'envoyer tout de même sans pièce jointe.

---

## 3. Contrôles et Validations Exécutés

Conformément à la règle **1.12** (*« Ne jamais prétendre qu'une vérification a réussi si elle n'a pas été exécutée »*) :

| Contrôle | Commande | Résultat |
| :--- | :--- | :--- |
| **Typage TypeScript Mobile** | `cd apps/mobile && npx tsc --noEmit` | ✅ **0 erreur** (Code retour 0) |
| **Compilation Backend NestJS** | `npm run -w apps/api build` | ✅ **Succès** (Code retour 0) |
| **Tests Unitaires Backend** | `npm run -w apps/api test` | ✅ **46/46 tests validés** (7 suites) |

---

## 4. Guide d'Utilisation pour l'Utilisateur

1. **Importer votre CV :**
   - Ouvrez l'onglet **Paramètres** de l'application.
   - Dans la section **Curriculum Vitae (PDF)**, appuyez sur **Importer mon CV (PDF)**.
   - Sélectionnez votre fichier `.pdf` (taille max. 10 Mo). Le fichier est automatiquement stocké sur votre téléphone et synchronisé sur l'API.
2. **Vérifier ou Prévisualiser :**
   - Depuis les **Paramètres**, appuyez sur le bouton **Voir** pour visualiser votre CV dans votre visionneuse PDF.
   - Lors de l'envoi d'une candidature depuis une fiche entreprise, appuyez sur **Prévisualiser l'e-mail** : le bloc **Pièce jointe** confirme la présence du CV.
3. **Tester la réception :**
   - Dans les **Paramètres**, utilisez le bouton **Envoyer un e-mail de test** : vous recevrez un e-mail sur votre adresse Gmail personnelle avec votre CV en pièce jointe réelle.
4. **Envoi aux entreprises :**
   - Tous les e-mails envoyés (envoi en masse sur l'accueil, envoi individuel ou relance automatique) intègrent automatiquement votre CV PDF en pièce jointe.

---

## 5. Proposition de Commit Git

Conformément aux directives de [Regles.md](../../Regles.md) :

```bash
git add . && git commit -m "feat: gestion stockage local et synchronisation du CV PDF avec envoi automatique par e-mail" && git push
```
