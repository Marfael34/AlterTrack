# Fiche de Suivi — Étape 5 : Notifications Push & Déploiement PC (Docker & Tailscale)

**Projet :** AlterTrack  
**Étape :** 5 / 5 — Notifications Push Expo, Conteneurisation Docker & Guide Tailscale PC  
**Date :** 13 Octobre 2026  
**Auteur :** Rafael Martinez & Assistant Antigravity  
**Statut :** ✅ Validé & Terminé  

---

## 1. Objectifs de l'étape

Conformément au [cahier_des_charges_complet.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/cahier_des_charges_complet.md) et aux [Regles.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/Regles.md) :
1. **Intégration des Notifications Push Expo :**
   - Service d'envoi HTTP de notifications push Expo (`https://exp.host/--/api/v2/push/send`) côté backend NestJS.
   - Mode simulation sécurisé sans plantage en l'absence de token enregistré.
   - Déclenchement automatique d'alertes instantanées sur le smartphone :
     - Dès qu'une réponse d'un recruteur est détectée lors du scan IMAP (statut `REPLY_RECEIVED`).
     - Dès qu'une relance téléphonique devient nécessaire à J+15 sans réponse (statut `TO_CALL`).
   - Enregistrement du token push depuis l'application mobile et synchronisation avec le backend via `PATCH /config/push-token`.
2. **Conteneurisation Docker de Production :**
   - `Dockerfile` multi-stage build optimisé et sécurisé pour l'API NestJS (Node 20 Alpine, utilisateur non-root `node`, migrations Prisma automatiques au démarrage).
   - `docker-compose.yml` multi-services (`postgres` + `api`) avec persistance des données (volumes PostgreSQL et stockage du CV PDF), healthcheck et redémarrage automatique `restart: always`.
3. **Guide de Déploiement PC Serveur 24/7 & Tailscale (0 €) :**
   - Rédiger un guide pas-à-pas complet pour configurer le PC secondaire en serveur autonome (anti-veille, capot fermé).
   - Mettre en place le réseau privé maillé chiffré Tailscale pour connecter le smartphone au serveur à distance sans ouvrir aucun port sur la box internet.

---

## 2. Réalisations techniques

### A. Notifications Push Backend (`apps/api/src/modules/notifications`)
- **[PushNotificationService](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/notifications/push-notification.service.ts)** :
  - Envoi vers l'API Expo Push via `fetch` standard Node 20.
  - Récupération dynamique du token via `AppConfigService`.
  - Journalisation en mode simulation si aucun token n'est configuré.
  - Gestion résiliente des erreurs réseau sans interruption des flux de relance ni des scans IMAP.
- **[NotificationsModule](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/notifications/notifications.module.ts)** :
  - Exporté et injecté dans [MailingModule](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/mailing/mailing.module.ts) et [SchedulerModule](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/scheduler/scheduler.module.ts).
- **Déclencheurs métier intégrés :**
  - Dans [MailingService.checkIncomingReplies()](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/mailing/mailing.service.ts) : alerte push `« Réponse reçue : [Nom Entreprise] »` avec corps `« Un recruteur a répondu à votre candidature ! Rendez-vous sur l'application pour décider de la suite. »`.
  - Dans [SchedulerService.triggerDailyTransitions()](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/scheduler/scheduler.service.ts) : alerte push `« Relance téléphonique requise : [Nom Entreprise] »` avec corps `« Sans réponse après 15 jours, il est temps de passer un appel téléphonique. »`.

### B. Intégration Mobile (`apps/mobile`)
- **[NotificationService](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/services/notification.service.ts)** :
  - Configuration du canal Android haute importance (`importance: MAX`, vibration, couleur violette `#8B5CF6`).
  - Gestion des permissions système (`requestPermissionsAsync`).
  - Obtention du token Expo Push (`getExpoPushTokenAsync`).
  - Enregistrement immédiat auprès de l'API (`ApiService.updatePushToken`).
- **[App.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/App.tsx)** :
  - Déclenchement automatique de l'enregistrement au lancement de l'application.
- **[SettingsScreen.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/screens/SettingsScreen.tsx)** :
  - Nouvelle Section 4 dédiée aux notifications push avec affichage de l'état du token et bouton d'action pour activer/ré-synchroniser le smartphone.

### C. Conteneurisation Docker
- **[apps/api/Dockerfile](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/Dockerfile)** :
  - Multi-stage build en 2 étapes (`builder` et `runner`).
  - Stage de production épuré basé sur `node:20-alpine` (aucune dépendance de développement superflue).
  - Script d'entrypoint qui applique automatiquement les migrations de base (`npx prisma migrate deploy`) avant de démarrer le serveur de production (`node dist/src/main.js`).
  - Exécution sous utilisateur système non-root `node` pour une sécurité renforcée.
- **[docker-compose.yml](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/docker-compose.yml)** :
  - Service `postgres` : PostgreSQL 16 Alpine, port 5432, volume persistant `postgres_data`, healthcheck périodique via `pg_isready`.
  - Service `api` : Port 3000, volume persistant `uploads_data` (`/app/uploads`), synchronisé avec la disponibilité vérifiée de la base de données.
  - Directive de résilience `restart: always` assurant le redémarrage automatique en cas de reboot de la machine hôte.

### D. Documentation Déploiement PC & Tailscale
- **[docs/GUIDE_DEPLOIEMENT_SERVEUR_TAILSCALE.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/docs/GUIDE_DEPLOIEMENT_SERVEUR_TAILSCALE.md)** :
  - Guide complet pour configurer le PC secondaire en serveur 24/7 sans surcoût (0 €).
  - Procédures anti-veille pour Linux (systemd-logind) et Windows.
  - Configuration du VPN privé maillé Tailscale (aucun port ouvert, chiffrement WireGuard, adresse IP fixe privée 100.x.y.z).
  - Guide d'association avec l'application mobile Android.

---

## 3. Contrôles et validations exécutés

| Type de contrôle | Commande | Résultat |
|---|---|---|
| **Compilation API NestJS** | `npm --prefix apps/api run build` | ✅ 0 erreur de compilation |
| **Tests Unitaires Backend** | `npm --prefix apps/api run test` | ✅ 29 tests réussis (8 suites) |
| **Tests E2E Backend** | `npm --prefix apps/api run test:e2e` | ✅ 3 tests réussis (HealthCheck & API Key) |
| **Linting Backend** | `npm --prefix apps/api run lint` | ✅ 0 erreur, 0 avertissement |
| **Typage TypeScript Mobile** | `npx tsc --noEmit` (mobile) | ✅ 0 erreur de typage |

---

## 4. Synthèse globale du projet AlterTrack

Avec l'achèvement de cette 5e étape, l'ensemble des 5 modules du [cahier_des_charges_complet.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/cahier_des_charges_complet.md) sont entièrement implémentés, testés et prêts pour la production :

1. **Étape 1 :** Socle Backend NestJS, PostgreSQL, Prisma ORM, CRUD Entreprises, API Key sécurisée, Upload de CV PDF.
2. **Étape 2 :** Intégration Google Gemini 2.5-flash (génération de mails contextuels), Envoi SMTP Gmail avec CV en pièce jointe, Relève IMAP Gmail avec détection des réponses recruteurs.
3. **Étape 3 :** Machine à états à 7 statuts, Planification Cron quotidienne (J+7, J+8, J+15) et IMAP (toutes les 10 min), Invariant anti-spam strict (max 1 relance par entreprise), Rattrapage résilient en cas de coupure.
4. **Étape 4 :** Application Mobile React Native Expo en Dark Mode, Dashboard avec filtres et compteurs dynamiques, Fiche entreprise avec bannière de décision prioritaire et appel direct, Écran Paramètres avec configuration Tailscale et import de CV.
5. **Étape 5 :** Notifications Push Expo temps réel (réponse recruteur et relance J+15), Dockerfile multi-stage, Docker Compose multi-conteneurs, Guide d'auto-hébergement Tailscale 0 €.
