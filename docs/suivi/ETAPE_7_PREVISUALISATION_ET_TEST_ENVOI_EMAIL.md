# Fiche de Suivi — Étape 7 : Prévisualisation & Test d'Envoi d'E-mail (IA & SMTP)

**Date :** 15 octobre 2026  
**Auteur :** Antigravity AI Assistant & Rafael Martinez  
**Projet :** AlterTrack — Gestionnaire Intelligent de Candidatures d'Alternance  
**Statut de l'étape :** ✅ TERMINÉE ET VALIDÉE

---

## 1. Objectifs de l'étape

Conformément à la demande utilisateur (*« Pour l'envoie de mail je veux pouvoir la tester avant d'envoyer des mail directement au entreprise »*) et aux exigences du document [Regles.md](../../Regles.md) :
1. **Permettre de tester l'envoi d'e-mail complet** (généré sur mesure par l'IA Google Gemini avec le CV PDF réel joint) vers la boîte personnelle du candidat avant tout envoi réel aux entreprises.
2. **Offrir une prévisualisation fidèle et instantanée** de l'objet et du corps du mail personnalisé pour n'importe quelle entreprise cible.
3. **Proposer le test d'envoi à deux niveaux stratégiques** :
   - Dans les **Paramètres** : validation globale du serveur SMTP (Gmail) et de l'IA avec mémorisation de l'adresse de test.
   - Dans la **Fiche Entreprise (`CompanyDetailScreen`)** : vérification et envoi test ciblé pour une entreprise spécifique en statut *À envoyer* (`TO_SEND`) ou *À relancer* (`TO_FOLLOW_UP`).
4. **Sécuriser l'envoi groupé en 1 clic** (`HomeScreen`) : proposer un bouton d'action directe *« Tester d’abord 🧪 »* avant de déclencher l'envoi en masse.
5. **Garantir un mode simulation élégant et sans crash** : si les identifiants Gmail (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) ne sont pas encore renseignés dans `.env`, simuler l'envoi avec accusé de réception explicite sans bloquer l'utilisateur.

---

## 2. Réalisations techniques

### 2.1 Backend NestJS (`apps/api`)

- **DTO de validation (`SendTestEmailDto`)** :
  - Création du fichier [apps/api/src/modules/mailing/dto/send-test-email.dto.ts](../../apps/api/src/modules/mailing/dto/send-test-email.dto.ts).
  - Validation stricte avec `class-validator` : `@IsEmail()`, `@IsNotEmpty()`, et `@IsOptional()` pour `companyName`.

- **Détection SMTP (`EmailService.isConfigured`)** :
  - Ajout d'une méthode d'inspection publique dans [apps/api/src/modules/mailing/email.service.ts](../../apps/api/src/modules/mailing/email.service.ts) retournant l'état de configuration du transporteur Nodemailer et l'utilisateur configuré.

- **Méthode d'orchestration (`MailingService.sendTestEmail`)** :
  - Implémentation dans [apps/api/src/modules/mailing/mailing.service.ts](../../apps/api/src/modules/mailing/mailing.service.ts).
  - Génère l'e-mail de motivation via `GeminiService` (adapté à l'entreprise cible spécifiée ou par défaut).
  - Vérifie la présence physique du CV (`uploads/cv/CV.pdf`) et le joint automatiquement.
  - Préfixe l'objet avec `[TEST ALTERTRACK]` pour identifier clairement l'e-mail de test.
  - Expédie le mail réel à `toEmail` ou trace une simulation si le SMTP n'est pas encore configuré.
  - Retourne un payload riche : statut de succès, destinataire, entreprise ciblée, objet, corps, nom de la pièce jointe, ID de message, indicateur `isSimulation` et note explicative.

- **Endpoint REST (`POST /mailing/send-test`)** :
  - Exposition dans [apps/api/src/modules/mailing/mailing.controller.ts](../../apps/api/src/modules/mailing/mailing.controller.ts) avec garde d'API statique (`ApiKeyGuard`).

- **Tests unitaires Backend (`mailing.service.spec.ts`)** :
  - Suite de tests `describe('sendTestEmail')` vérifiant le fonctionnement avec et sans CV attaché, en mode réel et en mode simulation (39 tests au total, 100% passants).

---

### 2.2 Frontend React Native / Mobile (`apps/mobile`)

- **Persistance locale (`StorageService`)** :
  - Ajout des méthodes `getTestEmail()` et `setTestEmail()` via `AsyncStorage` pour mémoriser automatiquement la boîte mail personnelle de l'utilisateur entre les sessions.

- **Service API (`ApiService`)** :
  - Ajout de `ApiService.sendTestEmail(toEmail, companyName)` et typage complet du retour.
  - Ajout de `ApiService.previewEmail(companyName, nature)` pour récupérer l'aperçu sans envoyer.

- **Composant Réutilisable (`EmailPreviewModal.tsx`)** :
  - Modal moderne au design épuré respectant la charte AlterTrack.
  - Génération à la volée de l'e-mail par Gemini lors de l'ouverture.
  - Badge indiquant l'état de la pièce jointe (CV.pdf joint ou manquant).
  - Bouton de régénération avec l'IA.
  - Section dédiée pour renseigner son e-mail et déclencher le test personnel.
  - Bannière de résultat dynamique (accusé de réception réel ou accusé de simulation pédagogique).

- **Fiche Entreprise (`CompanyDetailScreen.tsx`)** :
  - Bannière contextuelle en statut *À envoyer* (`TO_SEND`) avec bouton *« Aperçu & Tester l'e-mail IA »*.
  - Bouton de test dédié pour le statut *À relancer* (`TO_FOLLOW_UP`).
  - Action directe *« Tester l'e-mail IA »* à côté du champ e-mail de contact.

- **Écran des Paramètres (`SettingsScreen.tsx`)** :
  - Nouvelle section dédiée *« 🧪 Test d'envoi d'e-mail (SMTP & IA) »*.
  - Saisie de son e-mail de test et choix de l'entreprise cible.
  - Double action : *« Aperçu Gemini »* et *« Envoyer le test »*.
  - Carte récapitulative affichant le statut d'envoi et les détails du message.

- **Sécurisation de l'Envoi Groupé (`HomeScreen.tsx`)** :
  - Ajout d'une option directe *« Tester d’abord 🧪 »* dans l'alerte d'envoi groupé redirigeant immédiatement vers les Paramètres.

---

## 3. Contrôles et Validations Exécutés

Conformément à la règle **1.12** (*« Ne jamais prétendre qu'une vérification a réussi si elle n'a pas été exécutée »*) :

| Contrôle | Commande | Résultat |
| :--- | :--- | :--- |
| **Typage TypeScript Mobile** | `cd apps/mobile && npx tsc --noEmit` | ✅ **0 erreur** (Code retour 0) |
| **Tests Unitaires Backend** | `npm --prefix apps/api run test` | ✅ **39/39 tests validés** (6 suites, 0 régression) |
| **Compilation API NestJS** | `npm --prefix apps/api run build` | ✅ **Succès** (Build propre) |

---

## 4. Proposition de Commit Git

Conformément à [Regles.md](../../Regles.md) §13 :

```bash
git add . && git commit -m "feat(mailing): previsualisation et envoi d'e-mail de test personnel avant contact entreprise" && git push
```
