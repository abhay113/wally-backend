import { config as dotenvConfig } from "dotenv";

dotenvConfig();

export const config = {
  env: process.env.NODE_ENV || "development",
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",

  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "0.0.0.0",
  },

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  stellar: {
    network: process.env.STELLAR_NETWORK || "testnet",
    horizonUrl:
      process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org",
    friendbotUrl: "https://friendbot.stellar.org",
  },

  keycloak: {
    realm: process.env.KEYCLOAK_REALM!,
    authServerUrl: process.env.KEYCLOAK_AUTH_SERVER_URL!,
    clientId: process.env.KEYCLOAK_CLIENT_ID!,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
    adminUsername: process.env.KEYCLOAK_ADMIN_USERNAME!,
    adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD!,
  },

  encryption: {
    walletKey: process.env.WALLET_ENCRYPTION_KEY!,
  },

  limits: {
    funding: {
      rateLimitWindowMs: parseInt(
        process.env.FUNDING_RATE_LIMIT_WINDOW_MS || "86400000",
        10,
      ),
      rateLimitMax: parseInt(process.env.FUNDING_RATE_LIMIT_MAX || "3", 10),
      dailyCapXlm: parseFloat(process.env.FUNDING_DAILY_CAP_XLM || "10000"),
    },
    transaction: {
      minAmount: parseFloat(process.env.TRANSACTION_MIN_AMOUNT || "1"),
      maxAmount: parseFloat(process.env.TRANSACTION_MAX_AMOUNT || "100000"),
      dailyLimit: parseFloat(process.env.DAILY_TRANSACTION_LIMIT || "500000"),
    },
  },

  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || "5", 10),
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || "3", 10),
  },
};

// Validation: throw error if critical configs are missing
const requiredConfigs = [
  "DATABASE_URL",
  "KEYCLOAK_REALM",
  "KEYCLOAK_AUTH_SERVER_URL",
  "KEYCLOAK_CLIENT_ID",
  "WALLET_ENCRYPTION_KEY",
];

for (const key of requiredConfigs) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// Validate encryption key length (must be 32 bytes for AES-256)
const keyBuffer = Buffer.from(config.encryption.walletKey, "hex");
if (keyBuffer.length !== 32) {
  throw new Error("WALLET_ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
}
