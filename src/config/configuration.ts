export default () => ({
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN,
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshTtl: process.env.JWT_REFRESH_TTL,
  },
  mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY,
  cronSecret: process.env.CRON_SECRET,
  email: {
    brevoApiKey: process.env.BREVO_API_KEY,
    fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'no-reply@ubunturun.dev',
    fromName: process.env.EMAIL_FROM_NAME,
  },
  storage: {
    s3Endpoint: process.env.S3_ENDPOINT,
    s3Region: process.env.S3_REGION,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    s3Bucket: process.env.S3_BUCKET,
  },
});
