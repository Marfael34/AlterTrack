#!/bin/bash
# ==============================================================================
# AlterTrack - Script de Restauration de Sauvegarde PostgreSQL
# Usage : ./scripts/restore-db.sh backups/altertrack_backup_YYYYMMDD_HHMMSS.sql.gz
# ==============================================================================

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Erreur : Veuillez spécifier un fichier de sauvegarde existant."
  echo "Usage : $0 backups/altertrack_backup_YYYYMMDD_HHMMSS.sql.gz"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "${PROJECT_DIR}/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-altertrack-postgres}"
POSTGRES_USER="${POSTGRES_USER:-altertrack}"
POSTGRES_DB="${POSTGRES_DB:-altertrack_db}"

echo "⚠️  ATTENTION : Cette opération va écraser les données actuelles de ${POSTGRES_DB} !"
read -p "Voulez-vous continuer ? (tapez 'oui' pour confirmer) : " -r CONFIRM

if [ "$CONFIRM" != "oui" ]; then
  echo "Opération annulée."
  exit 0
fi

echo "Restauration en cours depuis ${BACKUP_FILE}..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "✅ Restauration terminée avec succès !"
