# Fiche de Suivi - Étape 13 : Statut Envoi Automatique (AUTO_SEND) & Distinction de l'Envoi Manuel (TO_SEND)

**Date :** 20 Octobre 2026  
**Branche :** `main`  
**Auteur :** Antigravity AI & Rafael Martinez  
**Statut :** Terminé & Validé  

---

## 1. Contexte & Demande Utilisateur

L'utilisateur a demandé :
> *"créer un nouveau status qui est pour envoyer les mail automatiquement, le status "a envoyer" actuel doit être pour moi si je veux l'envoyer moi même"*

### Clarifications et choix retenus :
- **Nouveau statut :** `AUTO_SEND` avec le libellé « Envoi automatique » et couleur violette (#8B5CF6).
- **Statut manuel conservé :** `TO_SEND` avec le nouveau libellé « À envoyer (manuel) » et couleur bleue (#0066FF).
- **Déclenchement automatique :**
  - Automatique chaque jour à 09:00 via le Cron serveur (`handleDailyStateMachine`).
  - Déclenchable immédiatement via le bouton d'envoi groupé sur l'accueil mobile (`handleSendBatch`).
- **Comportement par défaut :** Toute nouvelle entreprise créée manuellement ou importée via fichier tableur (CSV / Excel) reçoit par défaut le statut `AUTO_SEND`.

---

## 2. Réalisations Techniques

### A. Base de Données & Modèle Prisma (`apps/api`)
1. **Mise à jour du schéma Prisma :**
   - Ajout de `AUTO_SEND` dans l'énumération `Status`.
   - Définition de `@default(AUTO_SEND)` sur la colonne `status` du modèle `Company`.
2. **Migration PostgreSQL :**
   - Exécution SQL directe : `ALTER TYPE "Status" ADD VALUE 'AUTO_SEND';`
   - Définition de la valeur par défaut : `ALTER TABLE "Company" ALTER COLUMN "status" SET DEFAULT 'AUTO_SEND';`
   - Migration documentée et validée dans [apps/api/prisma/migrations/20261020140000_add_auto_send_status/migration.sql](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/prisma/migrations/20261020140000_add_auto_send_status/migration.sql) et enregistrée dans `_prisma_migrations`.
   - Régénération du client avec `npx prisma generate`.

### B. Backend NestJS (`apps/api`)
1. **Service Entreprises ([companies.service.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/companies/companies.service.ts)) :**
   - Initialisation de `AUTO_SEND: 0` dans le dictionnaire des statistiques (`getStats`).
   - Statut par défaut à `AUTO_SEND` lors de la création d'entreprise.
   - Support des libellés `"auto"`, `"auto_send"`, `"envoi auto"` lors de l'import tableur, avec fallback par défaut à `AUTO_SEND`.
2. **Service d'Envoi d'E-mails ([mailing.service.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/mailing/mailing.service.ts)) :**
   - Mise à jour de `sendInitialBatch()` : cible par défaut le statut `AUTO_SEND` lorsqu'aucun identifiant spécifique n'est transmis.
   - Maintien du support de `sendSingle()` pour envoyer immédiatement une candidature unitaire quel que soit son statut (`AUTO_SEND` ou `TO_SEND`).
3. **Planificateur & Machine à États ([scheduler.service.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/scheduler/scheduler.service.ts)) :**
   - Ajout de l'étape **0** dans `runStateMachineTransitions()` : envoi automatique quotidien à 09:00 des candidatures au statut `AUTO_SEND`.
   - Intégration de `autoSendPending` dans l'aperçu du planificateur (`getSchedulerOverview`).
4. **Tests Unitaires :**
   - [companies.service.spec.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/companies/companies.service.spec.ts), [mailing.service.spec.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/mailing/mailing.service.spec.ts) et [scheduler.service.spec.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/scheduler/scheduler.service.spec.ts) mis à jour pour `AUTO_SEND` (100% passants : 8 suites, 52 tests).

### C. Application Mobile React Native (`apps/mobile`)
1. **Typage & Constantes :**
   - [types/company.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/types/company.ts) : Ajout de `'AUTO_SEND'` au type `Status`, au dictionnaire `CompanyStats` et aux libellés `STATUS_LABELS`.
   - [constants/colors.ts](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/constants/colors.ts) : Définition de la couleur violette moderne `#8B5CF6` pour `AUTO_SEND`.
2. **Filtres et Navigation :**
   - [FilterTabs.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/components/FilterTabs.tsx) : Ajout de l'onglet « Envoi automatique » avec icône éclair (`flash`).
   - [FiltersModal.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/components/FiltersModal.tsx) : Prise en charge de `AUTO_SEND` dans la liste complète des statuts.
   - [CompanyMapView.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/components/CompanyMapView.tsx) : Intégration de `AUTO_SEND` dans les filtres carte et pins colorés.
3. **Écrans Applicatifs :**
   - [HomeScreen.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/screens/HomeScreen.tsx) :
     - Bouton header d'envoi groupé dédié aux candidatures en `AUTO_SEND` avec compteur dynamique et icône violette éclair.
     - Dialogue d'alerte et de confirmation adapté (« Lancer l'envoi automatique groupé »).
   - [AddCompanyScreen.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/screens/AddCompanyScreen.tsx) :
     - Statut par défaut initialisé à `AUTO_SEND`.
     - Choix disponibles clairs : « Envoi automatique » (violet) et « À envoyer (manuel) » (bleu).
   - [CompanyDetailScreen.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/screens/CompanyDetailScreen.tsx) :
     - Deux bannières d'actions distinctes :
       - **Pour `AUTO_SEND` :** Bannière violette indiquant que la candidature partira au lot automatique (avec boutons « Envoyer maintenant » et « Aperçu / Test »).
       - **Pour `TO_SEND` :** Bannière bleue dédiée à l'envoi manuel réservé à l'utilisateur (avec boutons « Envoyer la candidature » et « Aperçu / Test »).
   - [ProfileScreen.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/screens/ProfileScreen.tsx) : Prise en compte de `stats.AUTO_SEND` dans le total des entreprises suivies.

---

## 3. Fichiers Modifiés et Créés

| Fichier | Nature | Description |
|---|---|---|
| `apps/api/prisma/schema.prisma` | **Modification** | Ajout de `AUTO_SEND` dans l'énumération `Status` et statut par défaut. |
| `apps/api/prisma/migrations/20261020140000_add_auto_send_status/migration.sql` | **Création** | Script de migration SQL de la base PostgreSQL. |
| `apps/api/src/modules/companies/companies.service.ts` | **Modification** | Statut par défaut `AUTO_SEND`, comptabilisation dans les stats et import tableur. |
| `apps/api/src/modules/companies/companies.service.spec.ts` | **Modification** | Tests unitaires de création et stats pour `AUTO_SEND`. |
| `apps/api/src/modules/mailing/mailing.service.ts` | **Modification** | Ciblage du statut `AUTO_SEND` pour les lots d'envoi automatique. |
| `apps/api/src/modules/mailing/mailing.service.spec.ts` | **Modification** | Tests unitaires du lot automatique avec `AUTO_SEND`. |
| `apps/api/src/modules/scheduler/scheduler.service.ts` | **Modification** | Envoi automatique des `AUTO_SEND` lors du Cron de 09:00 et indicateur d'aperçu. |
| `apps/api/src/modules/scheduler/scheduler.service.spec.ts` | **Modification** | Tests unitaires du Cron avec étape `AUTO_SEND`. |
| `apps/mobile/src/types/company.ts` | **Modification** | Ajout de `AUTO_SEND` et libellés français clairs. |
| `apps/mobile/src/constants/colors.ts` | **Modification** | Couleur violette `#8B5CF6` pour `AUTO_SEND`. |
| `apps/mobile/src/components/FilterTabs.tsx` | **Modification** | Onglet de filtrage `AUTO_SEND`. |
| `apps/mobile/src/components/FiltersModal.tsx` | **Modification** | Prise en compte de `AUTO_SEND` dans le modal de filtrage. |
| `apps/mobile/src/components/CompanyMapView.tsx` | **Modification** | Support de `AUTO_SEND` sur la carte satellite. |
| `apps/mobile/src/screens/AddCompanyScreen.tsx` | **Modification** | Choix du statut avec `AUTO_SEND` par défaut. |
| `apps/mobile/src/screens/CompanyDetailScreen.tsx` | **Modification** | Bannières d'action séparées pour `AUTO_SEND` et `TO_SEND`. |
| `apps/mobile/src/screens/HomeScreen.tsx` | **Modification** | Bouton et compteur d'envoi automatique de lot. |
| `apps/mobile/src/screens/ProfileScreen.tsx` | **Modification** | Calcul de `totalTracked` incluant `AUTO_SEND`. |
| `docs/suivi/ETAPE_13_STATUT_ENVOI_AUTOMATIQUE_AUTO_SEND.md` | **Création** | Documentation technique et fiche de suivi. |

---

## 4. Validations & Contrôles

- [x] **Compilation NestJS API :** `npm run build` exécuté avec succès $\rightarrow$ **0 erreur**.
- [x] **Tests NestJS API :** `npm test` $\rightarrow$ **8 test suites passées, 52/52 tests réussis**.
- [x] **Typecheck React Native :** `tsc --noEmit` exécuté avec succès $\rightarrow$ **0 erreur**.
- [x] **Rebuild de l'image Docker API :** `docker compose build api && docker compose up -d api` pour intégrer le nouveau client Prisma avec l'enum `Status.AUTO_SEND`.
- [x] **Test End-to-End :** `PATCH /companies/:id/status` avec `status: 'AUTO_SEND'` validé avec succès en local et à travers le tunnel Cloudflare.

---

## 5. Proposition de Commit Git

Conformément à la Règle 13 de `Regles.md` :

```bash
git add . && git commit -m "feat: ajout du statut Envoi automatique (AUTO_SEND) et distinction de l'envoi manuel" && git push
```
