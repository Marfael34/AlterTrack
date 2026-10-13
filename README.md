# AlterTrack — Gestionnaire Intelligent de Candidatures d'Alternance

<p align="center">
  <strong>Système automatisé de suivi, personnalisation par IA et relance de candidatures d'alternance</strong><br>
  <em>Hébergement 100% gratuit (0 €) sur PC secondaire &bull; Docker &bull; Tailscale &bull; React Native Expo &bull; NestJS</em>
</p>

---

## 🎯 Présentation du Projet

**AlterTrack** est une solution complète conçue pour maximiser le taux de réponse des candidatures d'alternance tout en éliminant la charge mentale du suivi :

1. **Génération d'emails personnalisés :** Google Gemini 2.5-flash analyse le profil de l'entreprise cible et votre modèle de référence pour rédiger un email d'accroche ou de relance unique.
2. **Envoi & Relève automatisés :** Envoi SMTP avec CV en pièce jointe PDF et surveillance IMAP périodique pour détecter immédiatement les réponses des recruteurs.
3. **Machine à états & Automatisation :** Cycle de vie rigoureux en 7 statuts avec transitions automatiques (J+7, J+8, J+15) et respect strict d'un invariant anti-spam (maximum 1 relance par entreprise).
4. **Application Mobile Dark Mode :** Interface fluide en React Native Expo avec alertes prioritaires, bannière de décision immédiate (`[ Accepter ]` / `[ Refuser ]`) et appel téléphonique en 1 clic.
5. **Notifications Push Instantanées :** Alertes sonores et visuelles via Expo Push dès qu'un recruteur répond ou qu'un appel téléphonique est nécessaire.
6. **Auto-hébergement sécurisé à 0 € :** Conteneurisation Docker complète et connexion à distance chiffrée via Tailscale sans aucun port ouvert sur votre box internet.

---

## 🏗 Architecture du Monorepo

```text
AlterTrack/
├── apps/
│   ├── api/                   # Backend NestJS (TypeScript, Node 20 LTS)
│   │   ├── prisma/            # Schéma Prisma 6 & migrations PostgreSQL
│   │   ├── src/
│   │   │   ├── modules/       # Companies, Gemini, Mailing, Scheduler, Notifications, AppConfig
│   │   │   └── common/        # Guards (API Key timing-safe), Decorators
│   │   └── Dockerfile         # Image de production multi-stage ultra-légère
│   │
│   └── mobile/                # Application Mobile React Native (Expo SDK 52)
│       ├── App.tsx            # Navigation principale & gestion Push
│       └── src/
│           ├── components/    # Cartes d'entreprises, badges statuts, filtres
│           ├── constants/     # Charte graphique Dark Mode (#0F172A) & tokens
│           ├── screens/       # Accueil, Fiche Entreprise, Ajout, Paramètres
│           └── services/      # Client API, stockage local, notifications Expo
│
├── docs/                      # Documentation technique & suivi
│   ├── suivi/                 # Fiches de suivi d'étapes (1 à 5)
│   └── GUIDE_DEPLOIEMENT_SERVEUR_TAILSCALE.md
├── docker-compose.yml         # Orchestration multi-conteneurs (API + PostgreSQL)
└── Regles.md                  # Règles et invariants d'architecture du projet
```

---

## 🔄 Cycle de vie d'une candidature (Machine à états)

```text
[ TO_SEND ] 
    │
    ▼ (Envoi en 1 clic ou lot)
[ WAITING_FOR_REPLY ] (J+0 à J+7)
    │
    ├─────────► [ REPLY_RECEIVED ] (Détection automatique IMAP) ──► [ ACCEPTED ] ou [ REFUSED ]
    │
    ▼ (Si aucune réponse à J+7)
[ TO_FOLLOW_UP ] 
    │
    ▼ (Relance automatique par IA à J+8)
[ WAITING_FOR_REPLY ] 
    │
    ├─────────► [ REPLY_RECEIVED ] ──► [ ACCEPTED ] ou [ REFUSED ]
    │
    ▼ (Si aucune réponse à J+15)
[ TO_CALL ] (Notification Push envoyée & bouton d'appel direct activé)
    │
    └─────────► [ ACCEPTED ] ou [ REFUSED ]
```

---

## 🚀 Démarrage Rapide

### 1. Prérequis
- Node.js 20 LTS & npm
- Docker & Docker Compose
- Clé d'API Google AI Studio (Gemini) gratuite
- Compte Gmail avec mot de passe d'application généré

### 2. Configuration des variables d'environnement
À la racine du projet :
```bash
cp .env.example .env
nano .env
```
Renseignez vos identifiants :
```ini
DATABASE_URL="postgresql://postgres:postgres_secure_pass@localhost:5432/altertrack?schema=public"
API_KEY="votre_cle_secrete_longue_et_aleatoire"
GEMINI_API_KEY="votre_cle_gemini_gratuite"
GMAIL_USER="votre_adresse@gmail.com"
GMAIL_APP_PASSWORD="mot_de_passe_application_google"
```

### 3. Lancement avec Docker Compose (Recommandé pour serveur)
```bash
docker compose up -d --build
```
Vérifiez l'état des conteneurs :
```bash
docker compose ps
docker compose logs -f api
```

### 4. Lancement en développement local

**Démarrer l'API NestJS :**
```bash
cd apps/api
npm install
npx prisma migrate dev
npm run start:dev
```

**Démarrer l'Application Mobile Expo :**
```bash
cd apps/mobile
npm install
npx expo start
```
Scannez le QR Code avec l'application Expo Go sur votre smartphone Android.

---

## 🧪 Tests & Qualité de code

L'ensemble de la suite de tests est validé avec 100% de succès :

```bash
# Compilation de l'API
npm --prefix apps/api run build

# Tests unitaires (29 tests)
npm --prefix apps/api run test

# Tests d'intégration End-to-End (3 tests)
npm --prefix apps/api run test:e2e

# Linting ESLint (0 erreur, 0 avertissement)
npm --prefix apps/api run lint

# Vérification du typage TypeScript Mobile
cd apps/mobile && npx tsc --noEmit
```

---

## 📚 Fiches de Suivi & Documentation

Toutes les étapes du projet disposent d'une fiche de suivi détaillée :

* 📄 [Étape 1 : Socle Backend & Base de données PostgreSQL](docs/suivi/ETAPE_1_SOCLE_BACKEND.md)
* 📄 [Étape 2 : Intégration Gemini & Envoi/Relève Gmail](docs/suivi/ETAPE_2_INTEGRATION_GEMINI_GMAIL.md)
* 📄 [Étape 3 : Automatisation, Machine à états & Cron Jobs](docs/suivi/ETAPE_3_AUTOMATISATION_MACHINE_A_ETATS.md)
* 📄 [Étape 4 : Application Mobile React Native Expo](docs/suivi/ETAPE_4_APPLICATION_MOBILE_REACT_NATIVE.md)
* 📄 [Étape 5 : Notifications Push & Déploiement PC](docs/suivi/ETAPE_5_NOTIFICATIONS_PUSH_ET_DEPLOIEMENT.md)
* 📘 [Guide complet de déploiement serveur 24/7 & Tailscale](docs/GUIDE_DEPLOIEMENT_SERVEUR_TAILSCALE.md)

---

## 🛡️ Sécurité & Bonnes Pratiques

- **Protection API Key :** Comparaison à temps constant (`crypto.timingSafeEqual`) pour immuniser contre les attaques temporelles.
- **Upload sécurisé :** Contrôle MIME strict (`application/pdf`), chemin canonique préfixé avec séparateur de répertoire strict (protection contre le path traversal) et noms de fichiers nettoyés.
- **Anti-spam garanti :** Invariant immuable limitant à un maximum de 2 emails envoyés par entreprise (1 candidature initiale + 1 relance unique).
- **Zéro fuite de données :** Réseau Tailscale chiffré de bout en bout en WireGuard ; aucun port entrant ouvert sur votre routeur/box internet.
