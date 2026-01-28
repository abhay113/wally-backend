/**
 * Centralized logger utility
 * Wraps Pino for consistent logging across the application
 */

import pino from "pino";
import { config } from "../config";

// Create logger instance
export const logger = pino({
  level: config.isDevelopment ? "debug" : "info",
  transport: config.isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
          colorize: true,
        },
      }
    : undefined,
});

/**
 * Log user action for audit trail
 */
export function logUserAction(params: {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}) {
  logger.info(
    {
      type: "user_action",
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      metadata: params.metadata,
    },
    `User action: ${params.action} on ${params.resource}`,
  );
}

/**
 * Log transaction event
 */
export function logTransaction(params: {
  transactionId: string;
  status: string;
  senderId: string;
  receiverId: string;
  amount: string;
  metadata?: Record<string, any>;
}) {
  logger.info(
    {
      type: "transaction",
      transactionId: params.transactionId,
      status: params.status,
      senderId: params.senderId,
      receiverId: params.receiverId,
      amount: params.amount,
      metadata: params.metadata,
    },
    `Transaction ${params.transactionId}: ${params.status}`,
  );
}

/**
 * Log security event
 */
export function logSecurityEvent(params: {
  event: string;
  userId?: string;
  ip?: string;
  metadata?: Record<string, any>;
}) {
  logger.warn(
    {
      type: "security",
      event: params.event,
      userId: params.userId,
      ip: params.ip,
      metadata: params.metadata,
    },
    `Security event: ${params.event}`,
  );
}

/**
 * Log error with context
 */
export function logError(params: {
  error: Error;
  context: string;
  userId?: string;
  metadata?: Record<string, any>;
}) {
  logger.error(
    {
      type: "error",
      context: params.context,
      userId: params.userId,
      error: {
        message: params.error.message,
        stack: params.error.stack,
        name: params.error.name,
      },
      metadata: params.metadata,
    },
    `Error in ${params.context}: ${params.error.message}`,
  );
}

export default logger;
