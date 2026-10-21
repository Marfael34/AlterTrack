export interface DownloadPageConfig {
  appName: string;
  version: string;
  fileSize: string;
  releaseDate: string;
  apkDownloadUrl: string;
  apiUrl: string;
}

export function renderDownloadPage(config: DownloadPageConfig): string {
  const { appName, version, fileSize, releaseDate, apkDownloadUrl } = config;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} — Téléchargement de l'Application Mobile Android (APK)</title>
  <meta name="description" content="Téléchargez l'application mobile ${appName} pour Android (.APK). Suivi de candidatures, e-mails IA Gemini, carte interactive et relances automatiques pour votre alternance.">
  <meta property="og:title" content="${appName} — Télécharger l'APK Android">
  <meta property="og:description" content="Le copilote intelligent de recherche d'alternance. Téléchargement direct de l'APK version ${version}.">
  <meta property="og:type" content="website">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #070A12;
      --bg-card: rgba(17, 24, 39, 0.75);
      --bg-card-hover: rgba(24, 34, 53, 0.85);
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-glow: rgba(0, 102, 255, 0.35);
      --primary: #0066FF;
      --primary-hover: #1A75FF;
      --accent-cyan: #00D2C4;
      --accent-green: #00F099;
      --accent-purple: #8B5CF6;
      --accent-orange: #F97316;
      --text-main: #F3F4F6;
      --text-muted: #9CA3AF;
      --text-dim: #6B7280;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg-dark);
      color: var(--text-main);
      line-height: 1.6;
      overflow-x: hidden;
      min-height: 100vh;
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(0, 102, 255, 0.15) 0%, transparent 40%),
        radial-gradient(circle at 85% 25%, rgba(0, 210, 196, 0.12) 0%, transparent 45%),
        radial-gradient(circle at 50% 85%, rgba(139, 92, 246, 0.1) 0%, transparent 50%);
      background-attachment: fixed;
    }

    h1, h2, h3, .brand-font {
      font-family: 'Outfit', sans-serif;
    }

    /* Container */
    .container {
      max-width: 1160px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* Header */
    header {
      padding: 24px 0;
      border-bottom: 1px solid var(--border-subtle);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(7, 10, 18, 0.8);
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--text-main);
    }

    .brand-icon {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0, 102, 255, 0.4);
    }

    .brand-icon svg {
      width: 24px;
      height: 24px;
      fill: #FFFFFF;
    }

    .brand-name {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(180deg, #FFFFFF 0%, #CBD5E1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-tag {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 8px;
      border-radius: 6px;
      background: rgba(0, 210, 196, 0.15);
      color: var(--accent-cyan);
      border: 1px solid rgba(0, 210, 196, 0.3);
    }

    .header-links {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.2s;
    }

    .header-link:hover {
      color: var(--text-main);
    }

    /* Hero Section */
    .hero {
      padding: 80px 0 60px;
      text-align: center;
    }

    .pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-radius: 9999px;
      background: rgba(0, 102, 255, 0.1);
      border: 1px solid rgba(0, 102, 255, 0.3);
      color: #60A5FA;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 24px;
      animation: pulseGlow 3s infinite;
    }

    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 15px rgba(0, 102, 255, 0.2); }
      50% { box-shadow: 0 0 25px rgba(0, 210, 196, 0.3); }
    }

    .hero-title {
      font-size: clamp(34px, 5.5vw, 56px);
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -1px;
      margin-bottom: 20px;
      background: linear-gradient(180deg, #FFFFFF 20%, #94A3B8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-title span {
      background: linear-gradient(90deg, #00D2C4 0%, #0066FF 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-subtitle {
      max-width: 680px;
      margin: 0 auto 40px;
      font-size: clamp(16px, 2vw, 19px);
      color: var(--text-muted);
      line-height: 1.6;
    }

    /* Download Card Main */
    .download-card {
      max-width: 720px;
      margin: 0 auto;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 24px;
      padding: 40px 36px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(20px);
      position: relative;
      overflow: hidden;
    }

    .download-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--accent-cyan) 0%, var(--primary) 50%, var(--accent-purple) 100%);
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .meta-box {
      text-align: left;
    }

    .meta-title {
      font-size: 13px;
      color: var(--text-dim);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .meta-value {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
    }

    .os-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 240, 153, 0.12);
      border: 1px solid rgba(0, 240, 153, 0.3);
      color: var(--accent-green);
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
    }

    /* Primary CTA Button */
    .btn-download-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      width: 100%;
      background: linear-gradient(135deg, #0066FF 0%, #0052CC 100%);
      color: #FFFFFF;
      text-decoration: none;
      padding: 20px 32px;
      border-radius: 16px;
      font-size: 18px;
      font-weight: 700;
      box-shadow: 0 8px 30px rgba(0, 102, 255, 0.45);
      transition: all 0.25s ease;
      cursor: pointer;
      border: none;
    }

    .btn-download-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 40px rgba(0, 102, 255, 0.6);
      background: linear-gradient(135deg, #1A75FF 0%, #0066FF 100%);
    }

    .btn-download-primary:active {
      transform: translateY(0);
    }

    .btn-download-primary svg {
      width: 26px;
      height: 26px;
      fill: currentColor;
    }

    /* QR Code Section inside Card */
    .qr-section {
      margin-top: 32px;
      padding-top: 28px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      gap: 24px;
      text-align: left;
    }

    .qr-wrapper {
      width: 110px;
      height: 110px;
      background: #FFFFFF;
      border-radius: 14px;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      flex-shrink: 0;
    }

    .qr-wrapper img {
      width: 100%;
      height: 100%;
      display: block;
    }

    .qr-info h3 {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 6px;
      color: var(--text-main);
    }

    .qr-info p {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 10px;
      line-height: 1.5;
    }

    .copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .copy-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .copy-btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid var(--accent-green);
      color: var(--accent-green);
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 100;
    }

    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    /* Steps Section */
    .section-title-wrap {
      text-align: center;
      margin: 80px 0 40px;
    }

    .section-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--accent-cyan);
      margin-bottom: 8px;
    }

    .section-title {
      font-size: clamp(26px, 4vw, 36px);
      font-weight: 800;
      letter-spacing: -0.5px;
    }

    .steps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
      margin-bottom: 60px;
    }

    .step-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 20px;
      padding: 30px 26px;
      position: relative;
      transition: all 0.3s ease;
    }

    .step-card:hover {
      border-color: var(--border-glow);
      transform: translateY(-4px);
      background: var(--bg-card-hover);
    }

    .step-number {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(0, 102, 255, 0.15);
      border: 1px solid rgba(0, 102, 255, 0.35);
      color: #60A5FA;
      font-size: 18px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      font-family: 'Outfit', sans-serif;
    }

    .step-card h3 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 10px;
    }

    .step-card p {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
    }

    /* Feature Grid */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 80px;
    }

    .feature-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 18px;
      padding: 24px;
      transition: all 0.3s ease;
    }

    .feature-card:hover {
      border-color: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
    }

    .feature-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .feature-card h4 {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .feature-card p {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    /* Footer */
    footer {
      border-top: 1px solid var(--border-subtle);
      padding: 40px 0;
      text-align: center;
      color: var(--text-dim);
      font-size: 13px;
      background: rgba(7, 10, 18, 0.95);
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .footer-links a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.2s;
    }

    .footer-links a:hover {
      color: var(--text-main);
    }

    /* Mobile adjustments */
    @media (max-width: 640px) {
      .download-card {
        padding: 28px 20px;
      }
      .card-top {
        flex-direction: column;
        align-items: flex-start;
      }
      .qr-section {
        flex-direction: column;
        align-items: flex-start;
      }
      .btn-download-primary {
        padding: 16px 20px;
        font-size: 16px;
      }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <header>
    <div class="container header-content">
      <a href="/" class="brand" id="brand-logo">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <span class="brand-name">${appName}</span>
        <span class="brand-tag">v${version}</span>
      </a>
      <div class="header-links">
        <a href="#guide" class="header-link" id="nav-guide">Guide d'installation</a>
        <a href="/health" class="header-link" id="nav-status" target="_blank">Statut API</a>
      </div>
    </div>
  </header>

  <!-- Hero & Main Download -->
  <main class="container">
    <section class="hero">
      <div class="pill-badge">
        <span>🚀 Version ${version} disponible pour Android</span>
      </div>
      <h1 class="hero-title">Le copilote intelligent de votre <span>Alternance</span></h1>
      <p class="hero-subtitle">
        Centralisez vos entreprises cibles, générez des e-mails percutants via IA Gemini, automatisez vos relances quotidiennes et visualisez vos trajets en direct.
      </p>

      <!-- Carte de téléchargement principale -->
      <article class="download-card" id="download-box">
        <div class="card-top">
          <div class="meta-box">
            <div class="meta-title">Application Android</div>
            <div class="meta-value">${appName} Mobile</div>
          </div>
          <div class="meta-box">
            <div class="meta-title">Taille du fichier</div>
            <div class="meta-value">${fileSize}</div>
          </div>
          <div class="meta-box">
            <div class="meta-title">Date de version</div>
            <div class="meta-value">${releaseDate}</div>
          </div>
          <div class="os-badge">
            <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
              <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4116 13.8533 8.082 12 8.082s-3.5902.3296-5.1368.868L4.841 5.447a.416.416 0 00-.5677-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396"/>
            </svg>
            Android 8.0+
          </div>
        </div>

        <!-- Bouton direct -->
        <a href="${apkDownloadUrl}" class="btn-download-primary" id="btn-download-apk" download>
          <svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
          Télécharger l'APK (.apk)
        </a>

        <!-- Section QR Code -->
        <div class="qr-section">
          <div class="qr-wrapper" id="qr-box">
            <img id="qr-image" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(apkDownloadUrl)}&bgcolor=FFFFFF&color=070A12&margin=0" alt="Scanner le QR Code pour télécharger l'APK AlterTrack" />
          </div>
          <div class="qr-info">
            <h3>Vous êtes sur ordinateur ?</h3>
            <p>Scannez simplement ce code QR avec l'appareil photo de votre smartphone Android pour lancer le téléchargement immédiat.</p>
            <button class="copy-btn" id="btn-copy-link" onclick="copyDownloadLink('${apkDownloadUrl}')">
              <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
              Copier le lien direct
            </button>
          </div>
        </div>
      </article>
    </section>

    <!-- Guide d'installation en 3 étapes -->
    <section id="guide">
      <div class="section-title-wrap">
        <div class="section-label">Installation Simple</div>
        <h2 class="section-title">Comment installer l'APK sur Android ?</h2>
      </div>

      <div class="steps-grid">
        <div class="step-card">
          <div class="step-number">1</div>
          <h3>Téléchargez le fichier</h3>
          <p>Appuyez sur le bouton bleu ci-dessus ou scannez le QR code. Le fichier <strong>altertrack-v${version}.apk</strong> se télécharge dans votre dossier Téléchargements.</p>
        </div>

        <div class="step-card">
          <div class="step-number">2</div>
          <h3>Autorisez la source</h3>
          <p>Si Chrome ou votre navigateur affiche l'avertissement <em>« Fichier potentiellement dangereux »</em>, appuyez sur <strong>Télécharger quand même</strong>. Cet avertissement standard s'affiche pour tout fichier hors Google Play.</p>
        </div>

        <div class="step-card">
          <div class="step-number">3</div>
          <h3>Ouvrez et installez</h3>
          <p>Touchez la notification de téléchargement terminé ou ouvrez votre gestionnaire de fichiers, puis sélectionnez <strong>Installer</strong>. Connectez-vous et commencez à prospecter !</p>
        </div>
      </div>
    </section>

    <!-- Fonctionnalités clés -->
    <section id="features">
      <div class="section-title-wrap">
        <div class="section-label">Fonctionnalités Clés</div>
        <h2 class="section-title">Tout ce dont vous avez besoin</h2>
      </div>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon-wrap" style="background: rgba(0, 102, 255, 0.15); color: var(--primary);">
            <svg style="width: 22px; height: 22px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm1 14.5h-2v-2h2zm0-4h-2V7h2z"/></svg>
          </div>
          <h4>Envoi Automatique & Manuel</h4>
          <p>Distinguez vos envois automatiques programmés chaque jour à 09:00 de vos candidatures ciblées manuelles.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-wrap" style="background: rgba(0, 210, 196, 0.15); color: var(--accent-cyan);">
            <svg style="width: 22px; height: 22px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9z"/></svg>
          </div>
          <h4>IA Gemini Personnalisée</h4>
          <p>Générez des courriels sur mesure adaptés à la culture de l'entreprise et joignez votre CV PDF automatiquement.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-wrap" style="background: rgba(0, 240, 153, 0.15); color: var(--accent-green);">
            <svg style="width: 22px; height: 22px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
          </div>
          <h4>Carte Satellite Plein Écran</h4>
          <p>Visualisez vos entreprises sur la carte, filtrez par statut et calculez la distance exacte depuis votre domicile.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-wrap" style="background: rgba(139, 92, 246, 0.15); color: var(--accent-purple);">
            <svg style="width: 22px; height: 22px; fill: currentColor;" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
          </div>
          <h4>Timeline d'Historique Active</h4>
          <p>Consignez chaque entretien RH, appel, relance LinkedIn ou dépôt en main propre avec sélecteur de date interactif.</p>
        </div>
      </div>
    </section>
  </main>

  <!-- Toast Notification -->
  <div class="toast" id="toast-msg">
    <svg style="width: 18px; height: 18px; fill: currentColor;" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    <span>Lien de téléchargement copié dans le presse-papiers !</span>
  </div>

  <!-- Footer -->
  <footer>
    <div class="container">
      <div class="footer-links">
        <a href="#download-box">Télécharger</a>
        <a href="#guide">Guide d'installation</a>
        <a href="/health">Statut du serveur</a>
      </div>
      <p>&copy; 2026 ${appName}. Tous droits réservés. Conçu pour booster votre recherche d'alternance.</p>
    </div>
  </footer>

  <script>
    // Mettre à jour l'URL absolue du QR Code au chargement
    window.addEventListener('DOMContentLoaded', () => {
      const currentUrl = window.location.origin + '/download/apk';
      const qrImg = document.getElementById('qr-image');
      if (qrImg) {
        qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(currentUrl) + '&bgcolor=FFFFFF&color=070A12&margin=0';
      }
    });

    function copyDownloadLink(fallbackUrl) {
      const fullUrl = window.location.origin + '/download/apk';
      navigator.clipboard.writeText(fullUrl).then(() => {
        showToast();
      }).catch(() => {
        navigator.clipboard.writeText(fallbackUrl).then(showToast);
      });
    }

    function showToast() {
      const toast = document.getElementById('toast-msg');
      if (!toast) return;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  </script>
</body>
</html>
`;
}
