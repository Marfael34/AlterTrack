export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  apiKey: process.env.API_KEY,
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  geminiApiKey: process.env.GEMINI_API_KEY,
  gmailUser: process.env.GMAIL_USER,
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
});
