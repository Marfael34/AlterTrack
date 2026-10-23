#!/usr/bin/env node

/**
 * Script de réinitialisation de mot de passe utilisateur AlterTrack
 * Usage : node scripts/reset-password.js <email> <nouveau_mot_de_passe>
 */

const { execSync, spawnSync } = require('child_process');
const bcrypt = require('bcryptjs');

const email = (process.argv[2] || '').trim().toLowerCase();
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('\n❌ Usage : node scripts/reset-password.js <email> <nouveau_mot_de_passe>\n');
  console.error('Exemple : node scripts/reset-password.js raphaelm0085@gmail.com MonMotDePasse123\n');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('\n❌ Le mot de passe doit comporter au moins 6 caractères.\n');
  process.exit(1);
}

try {
  console.log(`\nRecherche du compte ${email}...`);
  const checkUser = execSync(
    `docker exec altertrack-postgres psql -U altertrack -d altertrack_db -t -c "SELECT id, \\"fullName\\" FROM \\"User\\" WHERE email = '${email}';"`,
    { encoding: 'utf-8' }
  ).trim();

  if (!checkUser) {
    console.error(`\n❌ Aucun utilisateur trouvé avec l'adresse e-mail : ${email}\n`);
    process.exit(1);
  }

  const [id, fullName] = checkUser.split('|').map((s) => s.trim());
  console.log(`Compte trouvé : ${fullName} (${id})`);

  console.log('Hachage sécurisé du mot de passe avec bcrypt...');
  const hashedPassword = bcrypt.hashSync(newPassword, 10);

  const sql = `UPDATE "User" SET password = '${hashedPassword}', "updatedAt" = NOW() WHERE email = '${email}';`;
  const result = spawnSync('docker', ['exec', '-i', 'altertrack-postgres', 'psql', '-U', 'altertrack', '-d', 'altertrack_db'], {
    input: sql,
    encoding: 'utf-8',
  });

  if (result.error || result.status !== 0) {
    throw new Error(result.stderr || result.error?.message || 'Erreur SQL');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ MOT DE PASSE RÉINITIALISÉ AVEC SUCCÈS !');
  console.log('═'.repeat(60));
  console.log(`  📧 E-mail        : ${email}`);
  console.log(`  🔑 Nouveau pass  : ${newPassword}`);
  console.log('═'.repeat(60) + '\n');
} catch (err) {
  console.error('\n❌ Erreur lors de la mise à jour du mot de passe :', err.message);
  process.exit(1);
}
