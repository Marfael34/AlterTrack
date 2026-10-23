#!/usr/bin/env node

/**
 * Watchdog & Keep-Alive Cloudflare Tunnel pour AlterTrack.
 * 
 * Rôles :
 * 1. Envoie un ping régulier (/health) toutes les 30 secondes pour empêcher
 *    Cloudflare de fermer le tunnel pour inactivité (keep-alive permanent).
 * 2. Si le tunnel est coupé ou que Cloudflare invalide la session (erreur "Tunnel not found"),
 *    le watchdog redémarre automatiquement le conteneur Docker `altertrack-tunnel`.
 * 3. Récupère la nouvelle URL publique HTTPS et met à jour `apps/mobile/src/constants/tunnelUrl.json`
 *    pour que l'application mobile se reconnecte immédiatement et sans intervention.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TUNNEL_JSON_PATH = path.resolve(__dirname, '../apps/mobile/src/constants/tunnelUrl.json');
const PING_INTERVAL_MS = 10 * 1000; // 10 secondes pour réactivité maximale
const MAX_FAILURES_BEFORE_RESTART = 1;

let consecutiveFailures = 0;
let currentUrl = null;
let lastHeartbeatLoggedAt = 0;

function log(msg) {
  const time = new Date().toLocaleTimeString('fr-FR');
  console.log(`[${time}] ${msg}`);
}

function getUrlFromDockerLogs() {
  try {
    const logs = execSync('docker logs altertrack-tunnel 2>&1', { encoding: 'utf-8' });
    const matches = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
    if (matches && matches.length > 0) {
      return matches[matches.length - 1];
    }
  } catch {
    // Le conteneur altertrack-tunnel n'est peut-être pas démarré
  }
  return null;
}

function saveUrl(url) {
  try {
    const data = {
      url: url,
      updatedAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(TUNNEL_JSON_PATH), { recursive: true });
    fs.writeFileSync(TUNNEL_JSON_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    log(`❌ Erreur écriture tunnelUrl.json : ${err.message}`);
  }
}

function checkDockerLogsForTunnelError() {
  try {
    const logs = execSync('docker logs --tail 30 altertrack-tunnel 2>&1', { encoding: 'utf-8' });
    return logs.includes('Unauthorized: Tunnel not found') || logs.includes('ERR Register tunnel error');
  } catch {
    return false;
  }
}

async function restartTunnel() {
  log('🔄 Régénération / Redémarrage du conteneur Cloudflare Tunnel...');
  try {
    execSync('docker compose restart tunnel', { stdio: 'ignore' });
  } catch (err) {
    log(`❌ Erreur redémarrage tunnel : ${err.message}`);
  }

  // Attendre l'attribution de la nouvelle URL par Cloudflare
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const newUrl = getUrlFromDockerLogs();
    if (newUrl && newUrl !== currentUrl) {
      currentUrl = newUrl;
      saveUrl(newUrl);
      consecutiveFailures = 0;
      log(`✅ Nouveau tunnel régénéré et actif : \x1b[36m\x1b[1m${newUrl}\x1b[0m`);
      return true;
    }
  }

  log('⚠️ Impossible de récupérer la nouvelle URL après redémarrage.');
  return false;
}

async function pingTunnel(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${url}/health`, {
      signal: controller.signal,
      headers: { 'x-api-key': 'altertrack_dev_secret_key_2026_super_safe' },
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

async function cycle() {
  // 1. Détecter si une nouvelle URL a été attribuée par Docker (ex: suite à un docker compose up)
  const dockerUrl = getUrlFromDockerLogs();
  if (dockerUrl && dockerUrl !== currentUrl) {
    currentUrl = dockerUrl;
    saveUrl(currentUrl);
    consecutiveFailures = 0;
    log(`🔄 URL Cloudflare mise à jour depuis Docker : \x1b[36m\x1b[1m${currentUrl}\x1b[0m`);
  }

  // S'assurer d'avoir au moins une URL
  if (!currentUrl) {
    if (dockerUrl) {
      currentUrl = dockerUrl;
      saveUrl(currentUrl);
      log(`🔗 Tunnel Cloudflare détecté : \x1b[36m\x1b[1m${currentUrl}\x1b[0m`);
    } else {
      log('⚠️ Aucun tunnel actif détecté. Démarrage...');
      await restartTunnel();
      return;
    }
  }

  // 2. Vérifier si les logs Docker signalent déjà une déconnexion irrémédiable
  if (checkDockerLogsForTunnelError()) {
    log('⚠️ Session Cloudflare expirée détectée dans les logs (Tunnel not found).');
    await restartTunnel();
    return;
  }

  // 3. Ping keep-alive
  const isHealthy = await pingTunnel(currentUrl);

  if (isHealthy) {
    consecutiveFailures = 0;
    const now = Date.now();
    // Loguer discrètement toutes les 15 minutes pour confirmer le bon fonctionnement
    if (now - lastHeartbeatLoggedAt > 15 * 60 * 1000) {
      lastHeartbeatLoggedAt = now;
      log(`💓 Heartbeat OK — Tunnel actif et joignable : ${currentUrl}`);
    }
  } else {
    consecutiveFailures++;
    log(`⚠️ Échec du ping (${consecutiveFailures}/${MAX_FAILURES_BEFORE_RESTART}) sur ${currentUrl}`);

    // Re-vérifier d'abord si Docker a déjà une nouvelle URL sous le coude
    const freshUrl = getUrlFromDockerLogs();
    if (freshUrl && freshUrl !== currentUrl) {
      currentUrl = freshUrl;
      saveUrl(currentUrl);
      consecutiveFailures = 0;
      log(`✅ URL rafraîchie depuis Docker : ${currentUrl}`);
      return;
    }

    if (consecutiveFailures >= MAX_FAILURES_BEFORE_RESTART) {
      log('🚨 Le tunnel a expiré ou ne répond plus. Régénération automatique en cours...');
      await restartTunnel();
    }
  }
}

async function start() {
  console.log('\n' + '═'.repeat(68));
  console.log('  🛡️ ALTERTRACK — WATCHDOG & KEEP-ALIVE CLOUDFLARE TUNNEL');
  console.log('  Maintient la connexion active 24h/24 sans déconnexion');
  console.log('═'.repeat(68) + '\n');

  // Premier cycle immédiat
  await cycle();

  // Boucle de surveillance continue
  setInterval(async () => {
    try {
      await cycle();
    } catch (err) {
      log(`Erreur inattendue dans la boucle : ${err.message}`);
    }
  }, PING_INTERVAL_MS);
}

process.on('SIGINT', () => {
  log('Arrêt du watchdog.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Arrêt du watchdog.');
  process.exit(0);
});

void start();
