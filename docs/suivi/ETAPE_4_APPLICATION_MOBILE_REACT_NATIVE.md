# Fiche de Suivi — Étape 4 : Application Mobile React Native (Expo)

**Projet :** AlterTrack  
**Étape :** 4 / 5 — Application Mobile React Native (Expo) - UI, formulaires, upload  
**Date :** 13 Octobre 2026  
**Auteur :** Rafael Martinez & Assistant Antigravity  
**Statut :** ✅ Validé & Terminé  

---

## 1. Objectifs de l'étape

Conformément au [cahier_des_charges_complet.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/cahier_des_charges_complet.md) et aux [Regles.md](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/Regles.md) :
1. Initialiser l'application mobile React Native sous le framework Expo en TypeScript (`apps/mobile/`).
2. Appliquer la charte graphique Dark Mode à fort contraste (`#0F172A`, `#1E293B`, `#334155`) et les codes couleur distincts pour les 7 statuts métier.
3. Développer l'**Écran d'accueil (Dashboard & Liste)** :
   - Barre de recherche en temps réel par nom d'entreprise.
   - Barre d'onglets horizontale scrollable filtrant par statut avec compteurs dynamiques.
   - Liste virtualisée (`FlatList`) des cartes entreprises avec pull-to-refresh.
   - Bouton d'action flottant (+) pour ajouter une fiche.
   - Bouton flottant d'envoi groupé en 1 clic « Envoyer (X) » visible s'il y a des candidatures prêtes.
   - Bouton de synchronisation manuelle des réponses IMAP.
4. Développer l'**Écran Fiche Entreprise (Détail & Édition)** :
   - **Zone contextuelle prioritaire :** Bannière prépondérante avec deux boutons larges `[ Accepter ]` et `[ Refuser ]` lorsque le statut est `REPLY_RECEIVED`.
   - Bouton d'appel téléphonique direct (`Linking.openURL('tel:...')`) mis en évidence pour le statut `TO_CALL`.
   - Formulaire d'édition (nom, mail, téléphone, notes personnelles non transmises à l'IA, sélecteur de statut).
   - Bouton d'action de relance immédiate avec confirmation.
5. Développer l'**Écran d'ajout rapide** (`AddCompanyScreen`) pour créer de nouvelles fiches au statut `TO_SEND`.
6. Développer l'**Écran Paramètres** (`SettingsScreen`) :
   - Saisie et persistance de l'URL du serveur (IP Tailscale) et de la clé d'API statique.
   - Test de connectivité en direct vers `/health`.
   - Éditeur du modèle de mail de référence utilisé par Google Gemini.
   - Sélecteur de fichier PDF (`expo-document-picker`) et upload synchronisé vers le backend NestJS.
7. Valider l'intégrité TypeScript et la compilation globale.

---

## 2. Réalisations techniques

### Architecture Mobile (`apps/mobile/src`)
- **[Colors](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/constants/colors.ts)** : Tokens de couleurs Dark Mode (fond `#0F172A`, cartes `#1E293B`) et palette des 7 statuts :
  - `TO_SEND` : `#3B82F6` (Bleu électrique)
  - `WAITING_FOR_REPLY` : `#F59E0B` (Jaune ambré)
  - `TO_FOLLOW_UP` : `#F97316` (Orange vif)
  - `REPLY_RECEIVED` : `#8B5CF6` (Violet lumineux — priorité visuelle)
  - `TO_CALL` : `#06B6D4` (Cyan)
  - `ACCEPTED` : `#10B981` (Vert émeraude)
  - `REFUSED` : `#EF4444` (Rouge corail)
- **Services** :
  - [StorageService](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/services/storage.service.ts) : Persistance de l'URL serveur et de la clé d'API via `@react-native-async-storage/async-storage`.
  - [ApiService](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/services/api.service.ts) : Client HTTP centralisé injectant automatiquement l'en-tête `x-api-key`, gérant le multipart/form-data pour le CV et les réponses d'erreur typées.
- **Composants** :
  - [StatusBadge](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/components/StatusBadge.tsx) : Badge d'état avec point lumineux et libellé traduit.
  - [FilterTabs](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/components/FilterTabs.tsx) : Barre d'onglets défilante avec pastilles de comptage par statut.
  - [CompanyCard](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/components/CompanyCard.tsx) : Carte entreprise avec raccourci d'appel, dates de contact et surbrillance contextuelle.
- **Écrans** :
  - [HomeScreen](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/screens/HomeScreen.tsx) : Vue principale avec recherche, filtres, relève IMAP en 1 clic et boutons flottants.
  - [CompanyDetailScreen](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/screens/CompanyDetailScreen.tsx) : Fiche complète avec bannière de décision Accepter/Refuser, appel direct et relance.
  - [AddCompanyScreen](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/screens/AddCompanyScreen.tsx) : Formulaire d'ajout rapide.
  - [SettingsScreen](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/screens/SettingsScreen.tsx) : Configuration réseau, upload du CV PDF et modèle de mail.
- **Point d'entrée** :
  - [App.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/App.tsx) : Navigation sécurisée entre les 4 écrans et gestion de la barre de statut Dark Mode.

---

## 3. Contrôles et validations exécutés

| Type de contrôle | Commande | Résultat |
|---|---|---|
| **Vérification TypeScript Mobile** | `npx tsc --noEmit` (mobile) | ✅ 0 erreur de typage |
| **Compilation Backend** | `npm --prefix apps/api run build` | ✅ 0 erreur de compilation |
| **Tests Backend (Unit & E2E)** | `npm --prefix apps/api run test && test:e2e` | ✅ 29 tests réussis (26 unitaires + 3 e2e) |
| **Linting Backend** | `npm --prefix apps/api run lint` | ✅ 0 erreur, 0 avertissement |

---

## 4. Décisions d'architecture structurantes

1. **Configuration d'accès serveur dynamique :** Pour permettre l'utilisation via Tailscale (`http://100.x.y.z:3000`) ou en local sans recompiler l'application, l'URL de base et la clé d'API sont modifiables directement dans l'écran Paramètres et persistées via `AsyncStorage`.
2. **Design System unifié :** Tous les styles exploitent les constantes définies dans `colors.ts`, évitant toute valeur en dur et garantissant une ergonomie cohérente.
3. **Upload natif du CV :** Intégration transparente de `expo-document-picker` avec filtrage `application/pdf` et synchronisation immédiate sur le backend.

---

## 5. Prochaine étape

* **Étape 5 : Notifications Push & Déploiement PC (Docker, Tailscale)**
  - Intégration d'Expo Push Notifications dans le backend (envoi d'une notification sur le smartphone dès qu'une réponse est détectée par IMAP ou qu'une fiche passe à `TO_CALL`).
  - Configuration du Dockerfile de production pour l'API NestJS.
  - Finalisation du `docker-compose.yml` multi-conteneurs (NestJS API + PostgreSQL).
  - Guide complet de déploiement et configuration Tailscale sur PC secondaire.
