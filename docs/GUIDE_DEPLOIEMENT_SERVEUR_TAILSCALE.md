# Guide de Déploiement : Transformer le Second PC en Serveur 24/7 (Docker & Tailscale)

**Projet :** AlterTrack — Automatisation de Candidatures d'Alternance  
**Date :** Octobre 2026  
**Objectif :** Héberger gratuitement (0 €) le backend NestJS, la base PostgreSQL et les Cron Jobs sur un ordinateur secondaire, et s'y connecter de manière sécurisée depuis l'application mobile Android où que vous soyez.

---

## 1. Préparation du PC Serveur

Le PC secondaire (tour ou ordinateur portable sous Linux Ubuntu, Debian ou Windows) doit rester alimenté et allumé en continu pour que les relances et la surveillance IMAP s'exécutent même en votre absence.

### A. Désactivation de la mise en veille
* **Sur Ubuntu / Linux :**
  1. Ouvrez l'application **Paramètres** $\rightarrow$ **Énergie**.
  2. Passez l'option **Mise en veille automatique** sur **Désactivée**.
  3. Si c'est un ordinateur portable, désactivez la mise en veille à la fermeture du capot :
     ```bash
     sudo nano /etc/systemd/logind.conf
     ```
     Décommentez et modifiez la ligne suivante :
     ```ini
     HandleLidSwitch=ignore
     ```
     Enregistrez (`Ctrl+O`, `Entrée`, `Ctrl+X`) puis redémarrez le service :
     ```bash
     sudo systemctl restart systemd-logind
     ```

* **Sur Windows :**
  1. Ouvrez les **Paramètres** $\rightarrow$ **Système** $\rightarrow$ **Marche/Arrêt et veille**.
  2. Définissez **Veille : Jamais**.

---

## 2. Déploiement avec Docker & Docker Compose

Docker assure l'exécution autonome et le redémarrage automatique en cas de redémarrage ou de coupure électrique grâce à la directive `restart: always`.

### A. Installation de Docker
Sur Linux (Ubuntu/Debian) :
```bash
# Installation de Docker Engine et Docker Compose
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```
*(Déconnectez-vous et reconnectez-vous pour que le groupe docker soit effectif sans sudo)*.

### B. Configuration de l'environnement (.env)
Sur le PC serveur, dans le dossier du projet :
```bash
cp .env.example .env
nano .env
```
Renseignez vos vraies clés :
- `DATABASE_URL` : Chaîne PostgreSQL (par exemple celle par défaut du docker-compose).
- `API_KEY` : Votre clé secrète longue (minimum 16 caractères).
- `GEMINI_API_KEY` : Votre clé d'API gratuite Google AI Studio.
- `GMAIL_USER` : Votre adresse Gmail personnelle.
- `GMAIL_APP_PASSWORD` : Votre mot de passe d'application Google (16 lettres sans espaces).

### C. Lancement des conteneurs
Depuis la racine du projet AlterTrack :
```bash
# Construction de l'image NestJS et démarrage en arrière-plan
docker compose up -d --build
```

### D. Vérification du bon fonctionnement
```bash
# Vérifier l'état des conteneurs
docker compose ps

# Consulter les logs de l'API en temps réel
docker compose logs -f api
```
Vous devriez voir :
```text
Serveur AlterTrack API démarré sur le port 3000
Connecté à PostgreSQL database via Prisma...
Client Google Gemini initialisé avec succès.
```

---

## 3. Accès à distance gratuit et sécurisé avec Tailscale

**Tailscale** crée un réseau privé virtuel chiffré (VPN maillé basé sur WireGuard).  
**Avantages majeurs :**
- Totalement **gratuit** pour un usage personnel (jusqu'à 100 appareils).
- **Aucun port à ouvrir** sur votre box internet (pas de redirection de port ni d'exposition au Web public).
- Attribue une **adresse IP fixe privée** (ex: `100.x.y.z`) à votre PC serveur.

### Étape 1 : Installation sur le PC Serveur
1. Créez un compte gratuit sur [tailscale.com](https://tailscale.com).
2. Installez Tailscale sur le PC serveur :
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
3. Suivez le lien d'authentification pour connecter le serveur à votre compte.
4. Récupérez l'adresse IP Tailscale du PC serveur :
   ```bash
   tailscale ip -4
   ```
   *(Exemple d'adresse obtenue : `100.85.120.45`)*.

### Étape 2 : Installation sur votre smartphone Android
1. Téléchargez l'application **Tailscale** sur le Google Play Store.
2. Connectez-vous avec le même compte.
3. Activez le VPN Tailscale sur votre téléphone.

---

## 4. Liaison avec l'Application Mobile AlterTrack

1. Ouvrez l'application **AlterTrack** sur votre smartphone.
2. Appuyez sur l'icône **⚙️ (Paramètres)** en haut à droite.
3. Renseignez :
   - **URL du serveur :** `http://100.x.y.z:3000` *(remplacez par l'IP Tailscale de votre PC serveur)*.
   - **Clé d'API statique :** la valeur de `API_KEY` configurée dans votre fichier `.env`.
4. Appuyez sur **« Tester la connexion »** :
   - Une alerte verte confirme : *« Connexion réussie ✅ »*.
5. Appuyez sur **« Importer un CV (PDF) »** pour envoyer votre CV depuis votre téléphone vers le serveur.

---

## 5. Maintenance et sauvegardes

### Commandes utiles :
* **Arrêter les conteneurs :** `docker compose down`
* **Redémarrer après modification de configuration :** `docker compose restart`
* **Sauvegarder la base de données PostgreSQL :**
  ```bash
  docker exec -t altertrack-postgres pg_dump -U altertrack altertrack_db > backup_altertrack_$(date +%F).sql
  ```
* **Restaurer une sauvegarde :**
  ```bash
  cat backup_altertrack_YYYY-MM-DD.sql | docker exec -i altertrack-postgres psql -U altertrack -d altertrack_db
  ```

Le PC serveur est désormais pleinement opérationnel, autonome 24h/24, et protégé dans votre réseau privé Tailscale !
