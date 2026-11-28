#!/usr/bin/env bash
# AlterTrack - Lance Expo pour le téléphone, sans configuration manuelle.
#   cd apps/mobile && npm start      (ou, à la racine : npm run dev)
#
#   1. Réseau : redirection de Metro et pare-feu Windows (fenêtre UAC seulement
#      au premier lancement ou quand l'IP de WSL a changé) ;
#   2. Vérifie que l'API (conteneurs Docker déjà lancés) répond ;
#   3. apps/mobile/.env : EXPO_PUBLIC_API_URL=http://<IP Wi-Fi du PC>:3000 ;
#   4. Metro : QR code exp://<IP Wi-Fi du PC>:8081 pour Expo Go.
#
# Le téléphone doit être sur le même Wi-Fi que le PC, VPN coupé.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/apps/mobile/.env"
WINDOWS_SCRIPT="$ROOT/scripts/dev-local-windows.ps1"
API_PORT=3000
METRO_PORT=8081
FIREWALL_RULE='AlterTrack dev local (API 3000, Metro 8081)'

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$1" >&2; exit 1; }

# Exécute une commande PowerShell (encodée pour éviter les problèmes de guillemets).
win_ps() {
  local encoded
  # $ProgressPreference : sans lui, PowerShell envoie des barres de progression
  # (CLIXML) sur la sortie d'erreur.
  encoded="$(printf '%s' "\$ProgressPreference = 'SilentlyContinue'; $1" | iconv -f utf-8 -t utf-16le | base64 -w0)"
  powershell.exe -NoProfile -NonInteractive -EncodedCommand "$encoded" 2>/dev/null | tr -d '\r'
}

network_ready() {
  local proxies firewall
  proxies="$(netsh.exe interface portproxy show v4tov4 | tr -d '\r')"
  grep -Eq "^0\.0\.0\.0 +$METRO_PORT +$WSL_IP +$METRO_PORT" <<<"$proxies" || return 1
  # Une ancienne redirection du port 3000 masquerait l'API publiée par Docker.
  ! grep -Eq "^0\.0\.0\.0 +$API_PORT " <<<"$proxies" || return 1
  firewall="$(win_ps "if (Get-NetFirewallRule -DisplayName '$FIREWALL_RULE' -ErrorAction SilentlyContinue) { 'ok' }")"
  [[ "$firewall" == "ok" ]]
}

# ---------------------------------------------------------------------------
step "1/4 Réseau Wi-Fi"
WIN_IP="$(win_ps '(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null } | Select-Object -First 1).IPv4Address.IPAddress' | head -n1)"
[[ -n "$WIN_IP" ]] || fail "IP Wi-Fi de Windows introuvable : le PC est-il connecté au Wi-Fi ?"
WSL_IP="$(hostname -I | awk '{print $1}')"
echo "PC (Wi-Fi) : $WIN_IP — WSL : $WSL_IP"

if network_ready; then
  echo "✅ Redirection et pare-feu déjà en place."
else
  echo "Configuration du réseau Windows : acceptez la fenêtre d'autorisation (UAC)…"
  # Copie dans le TEMP Windows : une session administrateur lit mal les chemins \\wsl.
  WIN_TEMP="$(win_ps '$env:TEMP' | head -n1)"
  cp "$WINDOWS_SCRIPT" "$(wslpath -u "$WIN_TEMP")/altertrack-dev-local.ps1"
  result="$(win_ps "try {
    Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ErrorAction Stop -ArgumentList @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', '\"$WIN_TEMP\\altertrack-dev-local.ps1\"', '-WslIp', '$WSL_IP'
    )
    'ok'
  } catch { 'refused' }")"
  [[ "$result" == "ok" ]] || fail "Autorisation refusée : le téléphone ne pourra pas joindre le PC."
  network_ready || fail "La configuration réseau n'a pas abouti. Lancez scripts/dev-local-windows.ps1 en administrateur pour voir l'erreur."
  echo "✅ Réseau configuré."
fi

# ---------------------------------------------------------------------------
step "2/4 API"
if curl -s -m 3 -o /dev/null -f "http://localhost:$API_PORT/health"; then
  echo "✅ API joignable."
else
  echo "⚠️  L'API ne répond pas sur le port $API_PORT : vérifiez vos conteneurs (docker ps)." >&2
  echo "   Expo démarre quand même ; l'app affichera une erreur de connexion tant que l'API est arrêtée." >&2
fi

# ---------------------------------------------------------------------------
step "3/4 Configuration de l'app"
API_URL="http://$WIN_IP:$API_PORT"
touch "$ENV_FILE"
if grep -q '^EXPO_PUBLIC_API_URL=' "$ENV_FILE"; then
  sed -i "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$API_URL|" "$ENV_FILE"
else
  echo "EXPO_PUBLIC_API_URL=$API_URL" >>"$ENV_FILE"
fi
echo "✅ API pour le téléphone : $API_URL"

# ---------------------------------------------------------------------------
step "4/4 Metro (Expo Go)"
# Un autre Metro sur 8081 ferait démarrer Expo sur un autre port, non redirigé.
if ss -ltn 2>/dev/null | grep -q ":$METRO_PORT "; then
  fail "Le port $METRO_PORT est déjà utilisé (un autre « expo start » ?). Arrêtez-le avec Ctrl+C, puis relancez npm run dev."
fi
echo "📱 Téléphone sur le même Wi-Fi que le PC, VPN coupé, puis scannez le QR code."
cd "$ROOT/apps/mobile"
# -c : le .env est intégré au bundle, il faut vider le cache après l'avoir modifié.
REACT_NATIVE_PACKAGER_HOSTNAME="$WIN_IP" exec npx expo start --lan -c
