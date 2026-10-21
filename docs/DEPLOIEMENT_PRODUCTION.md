# Guide de Mise en Production Complète — AlterTrack

Ce document détaille l'ensemble des procédures, configurations et commandes pour déployer la plateforme **AlterTrack** (API NestJS, base de données PostgreSQL et application mobile React Native / Expo) en environnement de production sécurisé, performant et pérenne.

---

## 1. Architecture Globale en Production

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        UTILISATEUR / APPAREIL                          │
│                                                                        │
│   Application Mobile Android (APK / AAB) ou iOS (App Store / TestFlight)
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Requêtes HTTPS sécurisées
                                    │ (x-api-key + Bearer JWT)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     SERVEUR DE PRODUCTION (VPS / CLOUD)                │
│                                                                        │
│  [Firewall UFW] : Ports 80 (HTTP) et 443 (HTTPS) ou Cloudflare Tunnel   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │     REVERSE PROXY (Nginx / Caddy / Certbot SSL Let's Encrypt)     │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
│                                   │ 127.0.0.1:3000                     │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                CONTENEUR DOCKER : altertrack-api                 │  │
│  │       - NestJS 11 (Node 20 Alpine)                               │  │
│  │       - Validation stricte des entrées (class-validator)         │  │
│  │       - En-têtes sécurisés Helmet & CORS restreint               │  │
│  │       - Authentification JWT (30d) + Mots de passe Argon2/Bcrypt │  │
│  │       - Planificateur Cron interne (Machine à états quotidienne) │  │
│  │       - Client Prisma 6 intégré (migrations automatiques)        │  │
│  │       - Intégrations : Google Gemini IA, Gmail SMTP / IMAP       │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
│                                   │ Réseau interne Docker bridge       │
│                                   │ altertrack-prod-net:5432           │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │             CONTENEUR DOCKER : altertrack-postgres               │  │
│  │       - PostgreSQL 16 Alpine                                     │  │
│  │       - Port 5432 NON exposé publiquement sur Internet           │  │
│  │       - Données persistées sur volume Docker : postgres_prod_data│  │
│  │       - Sauvegarde automatique quotidienne chiffrée / compressée │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prérequis Serveur (VPS / Dédié)

### Spécifications recommandées :
- **Système d'exploitation :** Ubuntu 22.04 LTS / 24.04 LTS ou Debian 12
- **Ressources :** 1 à 2 vCPU, 2 Go de RAM minimum, 20 Go d'espace disque SSD
- **Nom de domaine :** un sous-domaine pointant vers l'adresse IP publique du serveur (ex: `api.altertrack.fr`)

### Installation des paquets système indispensables :
```bash
# 1. Mise à jour du système
sudo apt update && sudo apt upgrade -y

# 2. Installation des outils de base
sudo apt install -y curl wget git ufw apt-transport-https ca-certificates gnupg lsb-release

# 3. Installation de Docker et du plugin Docker Compose
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. Autoriser l'utilisateur non-root à exécuter Docker
sudo usermod -aG docker $USER
newgrp docker
```

---

## 3. Configuration des Secrets de Production

### Étape 1 : Cloner le dépôt sur le serveur
```bash
git clone https://github.com/Marfael34/AlterTrack.git /home/ubuntu/AlterTrack
cd /home/ubuntu/AlterTrack
```

### Étape 2 : Générer des clés cryptographiques robustes
Ne **JAMAIS** utiliser les clés ou mots de passe de développement en production.
Générez de nouvelles clés aléatoires de 64 caractères hexadécimaux :
```bash
# Générer la clé d'API statique (API_KEY)
openssl rand -hex 32

# Générer le secret JWT (JWT_SECRET)
openssl rand -hex 32

# Générer le mot de passe de la base PostgreSQL
openssl rand -hex 24
```

### Étape 3 : Créer et configurer le fichier `.env` de production
Copiez le modèle de production et éditez-le avec vos vraies valeurs :
```bash
cp .env.example .env
nano .env
```

Contenu type du fichier `.env` de production :
```ini
# --- Serveur Backend ---
PORT=3000
NODE_ENV=production
API_KEY=coller_ici_la_cle_api_secrete_generee_precedemment
JWT_SECRET=coller_ici_le_secret_jwt_genere_precedemment
JWT_EXPIRES_IN=30d
CORS_ORIGINS=https://app.altertrack.fr,https://altertrack.fr
UPLOAD_DIR=/app/uploads

# --- Base de données PostgreSQL ---
POSTGRES_USER=altertrack_prod_user
POSTGRES_PASSWORD=coller_ici_le_mot_de_passe_db_robuste
POSTGRES_DB=altertrack_prod_db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://altertrack_prod_user:coller_ici_le_mot_de_passe_db_robuste@postgres:5432/altertrack_prod_db?schema=public

# --- Services Externes ---
GEMINI_API_KEY=AIzaSy...votre_cle_gemini_reelle
GMAIL_USER=mon.adresse.pro@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop

# --- Mobile ---
EXPO_PUBLIC_API_URL=https://api.altertrack.fr
```

Sécurisez les permissions du fichier `.env` :
```bash
chmod 600 .env
```

---

## 4. Déploiement du Backend avec Docker Compose

Pour la production, utilisez le fichier dédié `docker-compose.prod.yml` qui isole PostgreSQL du réseau public et configure les healthchecks :

```bash
# 1. Compiler les images Docker et lancer les conteneurs en tâche de fond
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

# 2. Vérifier l'état d'exécution et la santé des conteneurs
docker compose -f docker-compose.prod.yml ps
```

Résultat attendu :
```text
NAME                     IMAGE                  STATUS                   PORTS
altertrack-api-prod      altertrack-api-prod    Up (healthy)             127.0.0.1:3000->3000/tcp
altertrack-postgres-prod postgres:16-alpine     Up (healthy)             5432/tcp
```

### Vérifier le point de santé (Healthcheck) :
```bash
curl -i http://127.0.0.1:3000/health
```
Réponse attendue (`HTTP 200 OK`) :
```json
{
  "status": "ok",
  "timestamp": "2026-10-21T16:00:00.000Z",
  "uptime": 12.34,
  "database": "ok"
}
```

---

## 5. Configuration du Reverse Proxy HTTPS (Nginx & Certbot)

### Étape 1 : Installer Nginx et Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Étape 2 : Configurer le pare-feu UFW
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Étape 3 : Créer le fichier de configuration Nginx
Créez `/etc/nginx/sites-available/altertrack-api` :
```nginx
server {
    listen 80;
    server_name api.altertrack.fr;

    # Limite de taille pour l'upload de CV PDF (20 Mo)
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts pour la génération d'e-mails IA
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Activez le site et testez la syntaxe :
```bash
sudo ln -s /etc/nginx/sites-available/altertrack-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Étape 4 : Activer le certificat SSL Let's Encrypt (HTTPS gratuit et automatique)
```bash
sudo certbot --nginx -d api.altertrack.fr --non-interactive --agree-tos -m votre-email@domaine.com --redirect
```

Le renouvellement automatique est configuré d'office par Certbot via systemd timers. Testez-le :
```bash
sudo certbot renew --dry-run
```

---

## 6. Stratégie de Sauvegardes Automatiques PostgreSQL

La règle 7.5 de `Regles.md` impose une planification rigoureuse des sauvegardes et de la rétention.

### Script de sauvegarde automatique :
Le script [scripts/backup-db.sh](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/scripts/backup-db.sh) effectue un `pg_dump` compressé avec horodatage et nettoie automatiquement les sauvegardes de plus de 7 jours.

### Programmer le Cron quotidien :
Éditez la table cron de l'utilisateur :
```bash
crontab -e
```
Ajoutez la ligne suivante pour déclencher la sauvegarde chaque nuit à 03:00 du matin :
```cron
0 3 * * * /home/ubuntu/AlterTrack/scripts/backup-db.sh >> /var/log/altertrack-backup.log 2>&1
```

### Procédure de Restauration (en cas d'incident) :
Pour restaurer une sauvegarde précédente :
```bash
./scripts/restore-db.sh backups/altertrack_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

## 7. Compilation & Déploiement Mobile (EAS Build)

L'application mobile React Native utilise **Expo Application Services (EAS Build)** pour produire des binaires de production natifs.

### Étape 1 : Installer EAS CLI et se connecter
```bash
cd apps/mobile
npm install -g eas-cli
eas login
```

### Étape 2 : Configurer le projet Expo
```bash
eas build:configure
```

Le fichier `eas.json` configuré à la racine du dossier mobile supporte 3 profils :
1. `preview` : Génère un fichier `.apk` Android autonome directement installable sur n'importe quel smartphone sans passer par le store (idéal pour le test client en conditions réelles).
2. `production` : Génère un `.aab` (Android App Bundle) optimisé pour le Google Play Store et une archive iOS pour l'Apple App Store.

### Étape 3 : Lancer la compilation de l'APK de test (Preview)
```bash
eas build --platform android --profile preview
```
À la fin du build (environ 5-10 minutes sur le cloud Expo), un lien de téléchargement direct du fichier `.apk` vous est fourni ainsi qu'un QR code pour l'installer immédiatement sur votre smartphone Android.

### Étape 4 : Lancer la compilation pour publication sur les stores (Production)
```bash
# Pour Android (Google Play Store)
eas build --platform android --profile production

# Pour iOS (Apple App Store / TestFlight)
eas build --platform ios --profile production
```

### Étape 5 : Variables d'environnement de build EAS
Pour fixer l'URL de l'API de production dans le bundle compilé :
```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value https://api.altertrack.fr --type string
eas secret:create --name EXPO_PUBLIC_API_KEY --value votre_cle_api_secrete --type string
```

---

## 8. Procédure de Mise à Jour Sans Coupure (Zero Downtime)

Lors de la publication d'une nouvelle version de l'application :

```bash
# 1. Se positionner dans le projet
cd /home/ubuntu/AlterTrack

# 2. Récupérer les dernières modifications Git
git pull origin main

# 3. Créer une sauvegarde préventive de la base de données
./scripts/backup-db.sh

# 4. Recompiler et redémarrer les conteneurs
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

# 5. Les migrations Prisma s'appliquent automatiquement grâce au script entrypoint.sh
# 6. Vérifier la santé du service
docker compose -f docker-compose.prod.yml ps
curl -i http://127.0.0.1:3000/health
```

---

## 9. Commandes Utiles d'Exploitation

| Action | Commande |
| :--- | :--- |
| **Voir les logs de l'API en direct** | `docker compose -f docker-compose.prod.yml logs -f api` |
| **Voir les logs PostgreSQL** | `docker compose -f docker-compose.prod.yml logs -f postgres` |
| **Redémarrer l'API** | `docker compose -f docker-compose.prod.yml restart api` |
| **Ouvrir un shell dans le conteneur API** | `docker compose -f docker-compose.prod.yml exec api sh` |
| **Lancer une sauvegarde manuelle** | `./scripts/backup-db.sh` |
| **Vérifier l'utilisation disque / RAM** | `docker stats --no-stream` |
| **Vérifier le statut du renouvellement SSL** | `sudo certbot certificates` |
