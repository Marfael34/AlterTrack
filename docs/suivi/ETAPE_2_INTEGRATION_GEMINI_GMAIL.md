# Fiche de Suivi — Étape 2 : Intégration Gemini & Gmail

**Projet :** AlterTrack  
**Étape :** 2 / 5 — Intégration Gemini & Gmail (Génération, SMTP/IMAP)  
**Date :** 13 Octobre 2026  
**Auteur :** Rafael Martinez & Assistant Antigravity  
**Statut :** ✅ Validé & Terminé  

---

## 1. Objectifs de l'étape

Conformément au [cahier_des_charges_complet.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/cahier_des_charges_complet.md) et aux [Regles.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/Regles.md) :
1. Intégrer le SDK officiel Google Gen AI (`@google/genai`) avec le modèle recommandé `gemini-2.5-flash`.
2. Implémenter la génération d'e-mails sous contrainte stricte (température basse `0.3`, consigne anti-hallucination, sortie JSON structurée `{ subject, body }` et repli de sécurité).
3. Intégrer **Nodemailer** pour l'expédition SMTP sécurisée via Gmail (port 465 SSL, mot de passe d'application Google, pièce jointe CV PDF synchronisée).
4. Intégrer **ImapFlow** pour la relève sécurisée des e-mails entrants via IMAP (port 993 SSL, détection d'adresse et de nom de domaine).
5. Développer le service d'orchestration **MailingService** :
   - Envoi groupé en 1 clic pour le premier contact (`sendInitialBatch`).
   - Envoi de relance courtoise avec protection anti-spam critique (`sendFollowUp`).
   - Détection des réponses et transition automatique vers le statut `REPLY_RECEIVED` (`checkIncomingReplies`).
6. Valider l'étape par des tests unitaires, tests d'intégration, vérifications TypeScript et ESLint.

---

## 2. Réalisations techniques

### Module Gemini (`apps/api/src/modules/gemini`)
- **[GeminiService](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/gemini/gemini.service.ts)** :
  - Utilise l'API Google Gen AI avec `gemini-2.5-flash`.
  - Température fixée à `0.3` pour éliminer les risques d'hallucination.
  - Prompt système directif forçant le respect strict du modèle fourni par l'étudiant.
  - Format de réponse contraint en JSON strict (`responseMimeType: 'application/json'`).
  - Mécanisme de repli intelligent (*fallback*) actif si la clé d'API n'est pas encore saisie ou en cas de dépassement de quota, garantissant qu'aucun envoi n'échoue.

### Module Mailing (`apps/api/src/modules/mailing`)
- **[EmailService](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/mailing/email.service.ts)** :
  - Transporter Nodemailer configuré sur `smtp.gmail.com:465` (SSL).
  - Gestion des pièces jointes : attache automatiquement le CV PDF actif stocké dans `AppConfig`.
  - Mode simulation actif par défaut si les identifiants Gmail sont fictifs.
- **[ImapService](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/mailing/imap.service.ts)** :
  - Client ImapFlow configuré sur `imap.gmail.com:993` (SSL).
  - Parcours des boîtes de réception avec verrouillage (`getMailboxLock('INBOX')`) et extraction de l'expéditeur (adresse et nom de domaine).
- **[MailingService](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/mailing/mailing.service.ts)** :
  - `sendInitialBatch` : traite en lot les entreprises au statut `TO_SEND`, génère le contenu personnalisé, expédie le mail avec CV, met à jour `firstMailSentAt`, `lastMailId` et passe le statut à `WAITING_FOR_REPLY`.
  - `sendFollowUp` : vérifie la **règle anti-spam critique** (si `followUpSentAt` est déjà renseigné, rejet strict par `BadRequestException` empêchant tout spam), expédie la relance et met à jour `followUpSentAt`.
  - `checkIncomingReplies` : compare les expéditeurs reçus avec les entreprises en attente (`WAITING_FOR_REPLY`, `TO_FOLLOW_UP`, `TO_CALL`). Filtrage des webmails génériques (`GENERIC_EMAIL_DOMAINS` : Gmail, Outlook, Yahoo, Orange, Free, etc.) pour éviter tout faux positif lors de la comparaison par domaine. Passe automatiquement le statut à `REPLY_RECEIVED`.
- **[MailingController](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/api/src/modules/mailing/mailing.controller.ts)** :
  - `POST /mailing/send-initial`
  - `POST /mailing/send-follow-up/:id`
  - `POST /mailing/check-replies`
  - `POST /mailing/test-gemini`

---

## 3. Contrôles et validations exécutés

| Type de contrôle | Commande | Résultat |
|---|---|---|
| **Compilation TypeScript** | `npm run build` | ✅ 0 erreur de compilation |
| **Linting ESLint** | `npm run lint` | ✅ 0 erreur, 0 avertissement |
| **Tests unitaires** | `npm run test` | ✅ 4 suites passées, 21 tests réussis (GeminiService, MailingService, CompaniesService, ApiKeyGuard) |
| **Tests end-to-end** | `npm run test:e2e` | ✅ 1 suite passée, 3 tests réussis (/health public, 401 sans clé, 200 avec clé) |

---

## 4. Décisions d'architecture structurantes

1. **Isolation des domaines génériques (Anti faux-positifs IMAP) :** Pour la détection de réponse par nom de domaine (`fromDomain`), exclusion d'une liste blanche de fournisseurs grand public (`gmail.com`, `yahoo.fr`, `orange.fr`, etc.). Seuls les noms de domaine propres à l'entreprise peuvent matcher par domaine. L'adresse exacte matche quant à elle systématiquement.
2. **Invariance de la règle anti-spam :** Vérification stricte en amont dans `MailingService.sendFollowUp` de l'absence de valeur dans `followUpSentAt`.
3. **Résilience et Fallbacks :** Si l'API Gemini ou les identifiants Gmail ne sont pas encore configurés en local par l'utilisateur, l'API bascule gracieusement en simulation sans crash serveur.

---

## 5. Prochaine étape

* **Étape 3 : Automatisation & Machine à États (Cron Jobs)**
  - Intégration de `@nestjs/schedule` pour planifier les tâches d'arrière-plan.
  - Cron quotidien à minuit :
    - Règle J+7 : transition de `WAITING_FOR_REPLY` vers `TO_FOLLOW_UP` si premier contact $\ge 7$ jours sans réponse.
    - Règle J+8 : envoi automatique de la relance pour les fiches `TO_FOLLOW_UP` depuis 24h.
    - Règle J+15 : transition vers `TO_CALL` si relance $\ge 7$ jours sans réponse.
  - Cron toutes les 10 minutes : relève automatique IMAP pour détecter les réponses et passer en `REPLY_RECEIVED`.
