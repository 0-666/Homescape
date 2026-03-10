import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/proptech',
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  // World Labs (Marble API)
  worldLabs: {
    apiKey: process.env.WLT_API_KEY || '',
    baseUrl: process.env.WLT_API_BASE_URL || 'https://api.worldlabs.ai/marble/v1',
  },

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  // AWS
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'proptech-assets',
  },

  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Cache TTL (in seconds)
  cache: {
    searchResultsTTL: 300, // 5 minutes
    baseModelTTL: 3600, // 1 hour
  },

  // AI Generation
  aiGeneration: {
    timeout: 60000, // 60 seconds
    pollingInterval: 5000, // 5 seconds
  },

  // Call Recording
  callRecording: {
    retentionDays: 90,
  },

  // Lead Scoring
  leadScoring: {
    viewPoints: 20,
    savePoints: 30,
    designPoints: 40,
    callPoints: 50,
    transcriptMaxPoints: 20,
    decayPercentPerWeek: 10,
    hotLeadThreshold: 80,
  },

  // Commission
  commission: {
    tier1Rate: 0.02, // 2% for < $500K
    tier1Threshold: 500000,
    tier2Rate: 0.015, // 1.5% for $500K-$1M
    tier2Threshold: 1000000,
    tier3Rate: 0.01, // 1% for > $1M
    designFee: 50,
    designBuilderSplit: 0.7, // 70% to builder
    newPartnerWaiverCount: 3,
  },
};

export default config;
