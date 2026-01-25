export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public httpStatus: number = 500,
    public metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Authentication & Authorization
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", metadata?: Record<string, unknown>) {
    super("UNAUTHORIZED", message, 401, metadata);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", metadata?: Record<string, unknown>) {
    super("FORBIDDEN", message, 403, metadata);
  }
}

// Validation
export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400, metadata);
  }
}

// Resource Not Found
export class NotFoundError extends AppError {
  constructor(resource: string, metadata?: Record<string, unknown>) {
    super("NOT_FOUND", `${resource} not found`, 404, metadata);
  }
}

// Business Logic Errors
export class InsufficientBalanceError extends AppError {
  constructor(
    required: string,
    available: string,
    metadata?: Record<string, unknown>,
  ) {
    super(
      "INSUFFICIENT_BALANCE",
      `Insufficient balance. Required: ${required}, Available: ${available}`,
      400,
      { required, available, ...metadata },
    );
  }
}

export class WalletFrozenError extends AppError {
  constructor(walletId: string, metadata?: Record<string, unknown>) {
    super("WALLET_FROZEN", "Wallet is frozen", 403, {
      walletId,
      ...metadata,
    });
  }
}

export class UserBlockedError extends AppError {
  constructor(userId: string, metadata?: Record<string, unknown>) {
    super("USER_BLOCKED", "User account is blocked", 403, {
      userId,
      ...metadata,
    });
  }
}

export class DuplicateHandleError extends AppError {
  constructor(handle: string, metadata?: Record<string, unknown>) {
    super("DUPLICATE_HANDLE", `Handle ${handle} is already taken`, 409, {
      handle,
      ...metadata,
    });
  }
}

export class RateLimitExceededError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("RATE_LIMIT_EXCEEDED", message, 429, metadata);
  }
}

export class LimitExceededError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("LIMIT_EXCEEDED", message, 400, metadata);
  }
}

// Stellar/Blockchain Errors
export class StellarError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("STELLAR_ERROR", message, 500, metadata);
  }
}

export class TransactionFailedError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("TRANSACTION_FAILED", message, 500, metadata);
  }
}

// Conflict
export class ConflictError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("CONFLICT", message, 409, metadata);
  }
}

// Internal
export class InternalServerError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("INTERNAL_SERVER_ERROR", message, 500, metadata);
  }
}
