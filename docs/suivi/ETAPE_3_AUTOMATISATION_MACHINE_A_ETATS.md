# Fiche de Suivi — Étape 3 : Automatisation & Machine à États (Cron Jobs)

**Projet :** AlterTrack  
**Étape :** 3 / 5 — Automatisation & Machine à états (Cron Jobs J+7, J+8, J+15 et relève périodique IMAP)  
**Date :** 13 Octobre 2026  
**Auteur :** Rafael Martinez & Assistant Antigravity  
**Statut :** ✅ Validé & Terminé  

---

## 1. Objectifs de l'étape

Conformément au [cahier_des_charges_complet.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/cahier_des_charges_complet.md) et aux [Regles.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/Regles.md) :
1. Intégrer `@nestjs/schedule` pour la planification native des tâches d'arrière-plan sans dépendance externe lourde.
2. Implémenter le cycle quotidien de la machine à états (exécuté à 09:00 chaque jour) :
   - **Règle J+7 :** Passage automatique de `WAITING_FOR_REPLY` vers `TO_FOLLOW_UP` si le 1er e-mail a été envoyé il y a $\ge 7$ jours sans relance effectuée.
   - **Règle J+8 :** Envoi automatique de la relance personnalisée pour les entreprises au statut `TO_FOLLOW_UP` depuis $\ge 24$h (soit $\ge 8$ jours après le 1er e-mail), passage du statut à `WAITING_FOR_REPLY` et mise à jour de `followUpSentAt`.
   - **Règle J+15 :** Passage automatique de `WAITING_FOR_REPLY` vers `TO_CALL` si 7 jours supplémentaires se sont écoulés depuis la relance sans aucune réponse détectée.
3. Implémenter la surveillance périodique de la boîte Gmail (toutes les 10 minutes) via le Cron IMAP appelant `checkIncomingReplies()`.
4. Garantir le rattrapage automatique des retards grâce à l'utilisation systématique de conditions de date inférieures ou égales (`lte: dateThreshold`), protégeant le système en cas d'extinction temporaire du PC serveur.
5. Exposer un contrôleur REST d'administration et de test (`SchedulerController`) permettant de déclencher les crons à la demande et de visualiser l'état des files d'attente.

---

## 2. Réalisations techniques

### Module Scheduler (`apps/api/src/modules/scheduler`)
- **[SchedulerService](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/scheduler/scheduler.service.ts)** :
  - `@Cron(CronExpression.EVERY_DAY_AT_9AM)` : déclencheur automatique quotidien.
  - `@Cron('*/10 * * * *')` : déclencheur périodique toutes les 10 minutes pour la vérification IMAP.
  - `runStateMachineTransitions()` : orchestration en 3 temps (J+7, J+8, J+15) avec logging complet et comptabilisation des transitions.
  - `getSchedulerOverview()` : agrégation en temps réel du nombre de candidatures éligibles à chaque transition.
- **[SchedulerController](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/scheduler/scheduler.controller.ts)** :
  - `GET /scheduler/status` : diagnostic en direct des tâches planifiées et des fiches en attente de transition.
  - `POST /scheduler/trigger-transitions` : déclenchement manuel de la machine à états pour tester les règles sans attendre l'heure planifiée.
  - `POST /scheduler/trigger-imap` : déclenchement manuel de la synchronisation des réponses IMAP.
- **[AppModule](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/app.module.ts)** :
  - Import global de `ScheduleModule.forRoot()` initialisant le système de timers NestJS.

---

## 3. Contrôles et validations exécutés

| Type de contrôle | Commande | Résultat |
|---|---|---|
| **Compilation TypeScript** | `npm run build` | ✅ 0 erreur de compilation |
| **Linting ESLint** | `npm run lint` | ✅ 0 erreur, 0 avertissement |
| **Tests unitaires** | `npm run test` | ✅ 5 suites passées, 26 tests réussis (SchedulerService, MailingService, GeminiService, CompaniesService, ApiKeyGuard) |
| **Tests end-to-end** | `npm run test:e2e` | ✅ 1 suite passée, 3 tests réussis (/health public, 401 sans clé, 200 avec clé) |

---

## 4. Décisions d'architecture structurantes

1. **Rattrapage résilient (PC Serveur éteint) :** Utilisation systématique de filtres Prisma `{ lte: targetThreshold }`. Si le PC secondaire est éteint durant un week-end ou quelques jours, toutes les transitions et relances dues sont automatiquement traitées dès le redémarrage sans perte de contexte.
2. **Respect strict du tampon de 24h à J+8 :** Une entreprise ne reçoit pas sa relance le même jour que le passage à `TO_FOLLOW_UP` ; le seuil est fixé à `firstMailSentAt <= now - 8 jours`, assurant un délai de réflexion et évitant les envois prématurés.
3. **Observabilité immédiate :** L'endpoint `GET /scheduler/status` fournit une transparence totale sur le nombre de fiches prêtes pour chaque seuil (`j7ToFollowUp`, `j8AutoRelance`, `j15ToCall`).

---

## 5. Prochaine étape

* **Étape 4 : Application Mobile React Native (Expo)**
  - Initialisation du projet Expo TypeScript dans `apps/mobile/`.
  - Mise en place du Dark Mode à fort contraste (`#0F172A`, `#1E293B`, badges colorés).
  - Écran d'accueil (Dashboard, filtres par onglets, liste virtuelle des cartes entreprises, boutons d'action rapide / FAB).
  - Écran Fiche Entreprise (détail, édition, appel téléphonique direct en 1 clic, boutons contextuels Accepter / Refuser).
  - Écran Paramètres (édition du modèle de mail, sélection et synchronisation du CV PDF via `expo-document-picker`, configuration de l'IP du serveur).
