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
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'no-reply@ubunturun.dev',
  },
  storage: {
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2Bucket: process.env.R2_BUCKET,
    r2PublicUrl: process.env.R2_PUBLIC_URL,
  },
});
