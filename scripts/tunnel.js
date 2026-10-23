#!/usr/bin/env node

/**
 * Script de gestion du Tunnel Cloudflare pour AlterTrack.
 * Détecte l'URL publique HTTPS du tunnel et l'injecte dans la configuration mobile.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TUNNEL_JSON_PATH = path.resolve(__dirname, '../apps/mobile/src/constants/tunnelUrl.json');

function getUrlFromDockerLogs() {
  try {
    const logs = execSync('docker logs altertrack-tunnel 2>&1', { encoding: 'utf-8' });
    const matches = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
    if (matches && matches.length > 0) {
      return matches[matches.length - 1];
    }
  } catch (e) {
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
    console.error('Erreur lors de la sauvegarde de tunnelUrl.json :', err.message);
  }
}

function displayBanner(url) {
  console.log('\n' + '═'.repeat(68));
  console.log('  🌐 ALTERTRACK — ACCÈS PUBLIC DISTANT ACTIF (4G/5G & EXTÉRIEUR)');
  console.log('═'.repeat(68));
  console.log(`\n  🔗 URL publique HTTPS du serveur :`);
  console.log(`     \x1b[36m\x1b[1m${url}\x1b[0m\n`);
  console.log('  📱 Configuration sur votre téléphone :');
  console.log('     1. Ouvrez l’application AlterTrack.');
  console.log('     2. Allez dans Paramètres (icône ⚙️ en haut à droite).');
  console.log('     3. Dans le champ « URL du serveur », collez l’URL ci-dessus');
  console.log('        ou cliquez sur le bouton rapide « Utiliser le Tunnel Cloudflare ».');
  console.log('     4. Cliquez sur « Tester la connexion » (ou sauvegarder).\n');
  console.log('═'.repeat(68) + '\n');
}

async function main() {
  let url = getUrlFromDockerLogs();

  if (url) {
    saveUrl(url);
    displayBanner(url);
    return;
  }

  console.log('Démarrage du conteneur de tunnel AlterTrack...');
  try {
    execSync('docker compose up -d tunnel', { stdio: 'inherit' });
    // Attendre 3 secondes que Cloudflare assigne l'URL
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      url = getUrlFromDockerLogs();
      if (url) {
        saveUrl(url);
        displayBanner(url);
        return;
      }
    }
  } catch (err) {
    console.error('Erreur lors du démarrage du tunnel :', err.message);
  }

  if (!url) {
    console.error('\n⚠️ Impossible de récupérer l’URL Cloudflare Tunnel.');
    console.error('Assurez-vous que Docker est lancé et exécutez : docker compose up -d tunnel');
  }
}

void main();
