#!/bin/bash
# ==============================================================================
# AlterTrack - Script de Sauvegarde Automatisée PostgreSQL
# À planifier dans un cron quotidien (ex: 03:00 chaque nuit) :
# 0 3 * * * /home/utilisateur/AlterTrack/scripts/backup-db.sh >> /var/log/altertrack-backup.log 2>&1
# ==============================================================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/altertrack_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

# Charger les variables d'environnement
if [ -f "${PROJECT_DIR}/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-altertrack-postgres}"
POSTGRES_USER="${POSTGRES_USER:-altertrack}"
POSTGRES_DB="${POSTGRES_DB:-altertrack_db}"

mkdir -p "$BACKUP_DIR"

echo "=== [$(date)] Début de la sauvegarde AlterTrack ==="
echo "Conteneur : ${POSTGRES_CONTAINER}"
echo "Base de données : ${POSTGRES_DB}"
echo "Fichier cible : ${BACKUP_FILE}"

# Exécution du dump compressé
if docker exec -t "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"; then
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Sauvegarde réussie (${FILE_SIZE}) : ${BACKUP_FILE}"
else
  echo "❌ Erreur critique lors de l'exécution de pg_dump !"
  exit 1
fi

# Rotation des sauvegardes : suppression des fichiers de plus de RETENTION_DAYS jours
echo "Nettoyage des sauvegardes plus anciennes que ${RETENTION_DAYS} jours..."
find "$BACKUP_DIR" -type f -name "altertrack_backup_*.sql.gz" -mtime +"$RETENTION_DAYS" -exec rm -f {} \;

echo "=== [$(date)] Fin de la sauvegarde ==="
