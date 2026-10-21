export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  apiKey: process.env.API_KEY,
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  geminiApiKey: process.env.GEMINI_API_KEY,
  gmailUser: process.env.GMAIL_USER,
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
  jwtSecret: process.env.JWT_SECRET || process.env.API_KEY || 'altertrack_jwt_secure_session_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  corsOrigins: process.env.CORS_ORIGINS,
  apkDownloadUrl: process.env.APK_DOWNLOAD_URL,
  apkFilePath: process.env.APK_FILE_PATH,
});

