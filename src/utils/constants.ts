/**
 * System-wide constants
 */

/**
 * Default pagination values
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
} as const;

/**
 * Transaction limits (can be overridden by config)
 */
export const TRANSACTION_LIMITS = {
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 100000,
  DAILY_LIMIT: 500000,
} as const;

/**
 * Funding limits (can be overridden by config)
 */
export const FUNDING_LIMITS = {
  MAX_PER_DAY: 3,
  DAILY_CAP_XLM: 10000,
  FRIENDBOT_AMOUNT: 10000,
} as const;

/**
 * Wallet constants
 */
export const WALLET = {
  MIN_BALANCE: 0,
  ENCRYPTION_ALGORITHM: "aes-256-gcm",
  KEY_SIZE: 32, // bytes
  IV_SIZE: 16, // bytes
} as const;

/**
 * Handle validation
 */
export const HANDLE = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 30,
  REGEX: /^[a-z0-9_]+$/i,
} as const;

/**
 * Stellar network constants
 */
export const STELLAR = {
  TESTNET_HORIZON: "https://horizon-testnet.stellar.org",
  MAINNET_HORIZON: "https://horizon.stellar.org",
  FRIENDBOT: "https://friendbot.stellar.org",
  BASE_FEE: 100, // stroops
  MEMO_MAX_LENGTH: 28, // bytes
} as const;

/**
 * JWT constants
 */
export const JWT = {
  ALGORITHM: "RS256",
  ISSUER_PATH: "/protocol/openid-connect",
} as const;

/**
 * Rate limiting
 */
export const RATE_LIMIT = {
  GLOBAL_MAX: 100,
  GLOBAL_WINDOW: "1 minute",
  FUNDING_WINDOW_MS: 86400000, // 24 hours
} as const;

/**
 * Queue constants
 */
export const QUEUE = {
  TRANSACTION_QUEUE: "transaction-processing",
  DEFAULT_CONCURRENCY: 5,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // ms
  RETRY_BACKOFF_TYPE: "exponential",
} as const;

/**
 * API response messages
 */
export const MESSAGES = {
  SUCCESS: {
    USER_CREATED: "User created successfully",
    HANDLE_UPDATED: "Handle updated successfully",
    WALLET_FUNDED: "Wallet funded successfully",
    BALANCE_SYNCED: "Balance synced successfully",
    PAYMENT_INITIATED: "Payment initiated. Check status for confirmation.",
    STATUS_UPDATED: "Status updated successfully",
  },
  ERROR: {
    UNAUTHORIZED: "Missing or invalid authentication",
    FORBIDDEN: "Insufficient permissions",
    NOT_FOUND: "Resource not found",
    VALIDATION_FAILED: "Validation failed",
    INSUFFICIENT_BALANCE: "Insufficient balance",
    RATE_LIMIT_EXCEEDED: "Rate limit exceeded. Please try again later.",
    INTERNAL_ERROR: "An unexpected error occurred",
  },
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Transaction statuses
 */
export const TX_STATUS = {
  CREATED: "CREATED",
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

/**
 * User statuses
 */
export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  BLOCKED: "BLOCKED",
  SUSPENDED: "SUSPENDED",
} as const;

/**
 * Wallet statuses
 */
export const WALLET_STATUS = {
  ACTIVE: "ACTIVE",
  FROZEN: "FROZEN",
  CLOSED: "CLOSED",
} as const;

/**
 * Roles
 */
export const ROLES = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;

/**
 * Logging levels
 */
export const LOG_LEVELS = {
  TRACE: "trace",
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
} as const;
