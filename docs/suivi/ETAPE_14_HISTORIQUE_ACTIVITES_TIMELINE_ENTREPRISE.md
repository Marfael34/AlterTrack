# Fiche de Suivi - Étape 14 : Historique Dynamique des Activités & Ajout Manuel d'Actions

**Date :** 20 Octobre 2026  
**Branche :** `main`  
**Auteur :** Antigravity AI & Rafael Martinez  
**Statut :** Terminé & Validé  

---

## 1. Contexte & Demande Utilisateur

L'utilisateur a demandé :
> *"pour l'historique je veux qu'il se mette a jour des que je fait une action sur l'entreprise et je veux pouvoir ajouter une action dans l'historique"*

### Clarifications et choix retenus :
1. **Journalisation automatique de chaque action système :**
   - Création de l'entreprise (manuelle ou via import tableur).
   - Modification de la fiche entreprise (changement de coordonnées, notes, contact, etc.).
   - Changement de statut (manuel ou automatique, avec ancien et nouveau statut).
   - Appel téléphonique passé depuis la fiche mobile.
   - Envoi de candidature (initiale ou personnalisée).
   - Envoi de relance (automatique ou manuelle).
   - Réponse entrante détectée depuis Gmail.
2. **Ajout manuel d'actions personnalisé :**
   - Modal ergonomique et rapide avec sélection d'une catégorie :
     - 📞 **Appel téléphonique** (`CALL`)
     - 🤝 **Entretien RH** (`INTERVIEW_HR`)
     - 💻 **Entretien Technique** (`INTERVIEW_TECH`)
     - 💼 **Relance LinkedIn** (`LINKEDIN`)
     - ✉️ **Mail direct** (`DIRECT_MAIL`)
     - ✋ **Déposé en main propre** (`HAND_DELIVERED`)
     - 📝 **Note libre** (`NOTE`)
   - Titre pré-rempli dynamiquement modifiable ou personnalisable.
   - Champ descriptif multilignes pour saisir le compte-rendu ou les détails de l'échange.
   - Sélecteurs de date rapides (« Aujourd'hui », « Hier ») ou date/heure personnalisée.
3. **Format d'affichage :**
   - Timeline visuelle verticale interactive (du plus récent au plus ancien), remplaçant l'ancien bloc statique.
   - Badges colorés par type d'action avec icônes distinctes.
   - Horodatages relatifs et lisibles (« Aujourd'hui à 14:32 », « Hier à 10:15 », date formatée).
   - Bouton de suppression individuelle d'action.
   - Rétro-compatibilité : pour les entreprises existantes sans historique en base, génération dynamique de jalons initiaux basés sur leurs dates de création et d'envoi.

---

## 2. Réalisations Techniques

### A. Base de Données & Modèle Prisma (`apps/api`)
1. **Création du modèle `CompanyActivity` dans [schema.prisma](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/prisma/schema.prisma) :**
   - `id` : UUID unique.
   - `companyId` : référence vers `Company` avec suppression en cascade (`onDelete: Cascade`).
   - `type` : type d'action (`STATUS_CHANGE`, `EMAIL_SENT`, `FOLLOW_UP_SENT`, `INCOMING_REPLY`, `INFO_UPDATED`, `CALL`, `INTERVIEW_HR`, `INTERVIEW_TECH`, `LINKEDIN`, `DIRECT_MAIL`, `HAND_DELIVERED`, `NOTE`, `CREATION`).
   - `title` : titre synthétique de l'action.
   - `description` : détails textuels ou compte-rendu.
   - `metadata` : champ JSON optionnel pour données structurées.
   - `performedAt` : date et heure de l'action.
   - `createdAt` : date d'enregistrement.
   - Indexation optimisée sur `[companyId, performedAt]`.
2. **Migration PostgreSQL :**
   - Table créée et contraintes appliquées.
   - Migration documentée dans [apps/api/prisma/migrations/20261020143000_add_company_activity/migration.sql](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/prisma/migrations/20261020143000_add_company_activity/migration.sql) et enregistrée dans `_prisma_migrations`.
   - Client Prisma régénéré avec `npx prisma generate`.

### B. Backend NestJS (`apps/api`)
1. **DTOs d'activité :**
   - [create-activity.dto.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/companies/dto/create-activity.dto.ts) : validation stricte avec `class-validator` (`type`, `title`, `description`, `performedAt`).
   - [update-activity.dto.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/companies/dto/update-activity.dto.ts) : mise à jour flexible de la date (`performedAt`), du titre ou de la description.
2. **Service Entreprises ([companies.service.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/companies/companies.service.ts)) :**
   - Méthodes `recordActivity()`, `addActivity()`, `updateActivity()`, `getActivities()`, `deleteActivity()`.
   - Auto-journalisation intégrée sur `create()`, `update()`, `updateStatus()`, `importSpreadsheet()`.
   - Mécanisme de synthèse automatique des jalons pour les entreprises préexistantes n'ayant pas encore d'entrées d'activités.
3. **Contrôleur Entreprises ([companies.controller.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/companies/companies.controller.ts)) :**
   - `GET /companies/:id/activities` : récupération chronologique de l'historique complet.
   - `POST /companies/:id/activities` : ajout d'une action manuelle avec date personnalisée.
   - `PATCH /companies/:id/activities/:activityId` : modification de la date ou des informations d'une entrée.
   - `DELETE /companies/:id/activities/:activityId` : suppression d'une entrée de l'historique.
4. **Service d'Envoi d'E-mails ([mailing.service.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/mailing/mailing.service.ts)) :**
   - Enregistrement automatique d'activité sur `sendSingle()`, `sendInitialBatch()`, `sendFollowUp()`, et `checkIncomingReplies()`.
5. **Tests Unitaires :**
   - Tests mis à jour et passants dans [companies.service.spec.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/companies/companies.service.spec.ts) et [mailing.service.spec.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/mailing/mailing.service.spec.ts) (8 suites, 52 tests).

### C. Application Mobile React Native (`apps/mobile`)
1. **Typage & Client API :**
   - [types/company.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/types/company.ts) : interface `CompanyActivity` et types d'actions autorisés.
   - [api.service.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/services/api.service.ts) : fonctions `getCompanyActivities()`, `addCompanyActivity()`, `updateCompanyActivity()`, `deleteCompanyActivity()`.
2. **Composants Dédiés :**
   - [CustomDatePicker.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/components/CustomDatePicker.tsx) : sélecteur de date interactif complet (raccourcis Aujourd'hui / Hier / Calendrier, vue mensuelle avec navigation `<` `>`, sélection du jour, ajustement précis de l'heure et raccourcis d'heures).
   - [AddActivityModal.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/components/AddActivityModal.tsx) : modal d'ajout ergonomique intégrant `CustomDatePicker`, puces de catégories, pré-remplissage du titre et description.
   - [EditActivityModal.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/components/EditActivityModal.tsx) : modal de modification de la date et des détails d'une entrée existante de la timeline.
   - [CompanyActivityTimeline.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/components/CompanyActivityTimeline.tsx) : timeline verticale avec ligne directrice, pastilles icônisées, badges colorés, horodatages intelligents cliquables avec bouton d'édition (crayon), expansion du descriptif et suppression.
3. **Intégration dans l'Écran Détail ([CompanyDetailScreen.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/screens/CompanyDetailScreen.tsx)) :**
   - Remplacement de l'ancien bloc statique par la timeline interactive.
   - Rechargement temps réel de l'historique lors de chaque action (appel téléphonique, modification de statut, sauvegarde des infos, envoi d'e-mail).
   - Possibilité de modifier la date d'une entrée existante d'un simple toucher sur la date.

---

## 3. Validation & Tests Effectués

- **Tests unitaires NestJS :** 8 suites / 52 tests réussis (`npm test`).
- **Validation TypeScript :** 0 erreur dans `apps/mobile` (`tsc --noEmit`).
- **Tests d'intégration API réels :**
  - Ajout manuel d'une activité avec date passée (`POST /companies/:id/activities`) $\rightarrow$ code 201 créé.
  - Modification de la date (`PATCH /companies/:id/activities/:id`) $\rightarrow$ code 200, nouvelle date enregistrée avec succès.
  - Récupération de la liste (`GET /companies/:id/activities`) $\rightarrow$ code 200, ordonnancement chronologique vérifié.
  - Suppression d'activité (`DELETE /companies/:id/activities/:id`) $\rightarrow$ code 200 avec confirmation.
- **Docker :**
  - Image NestJS recompilée (`docker compose build api`).
  - Conteneur `altertrack-api` relancé et opérationnel sur le port 3000.

---

## 4. Bilan & Disponibilité

La fonctionnalité est immédiatement disponible dans l'application mobile et synchronisée avec le backend sans interruption de service.
