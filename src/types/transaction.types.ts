/**
 * Transaction-related type definitions
 */

import { TransactionStatus, TransactionType } from "../generated/client";

/**
 * Transaction creation parameters
 */
export interface CreateTransactionParams {
  senderUserId: string;
  recipientHandle: string;
  amount: string;
  idempotencyKey?: string;
}

/**
 * Transaction details for API response
 */
export interface TransactionDetails {
  id: string;
  senderId: string;
  receiverId: string;
  senderHandle: string;
  receiverHandle: string;
  amount: string;
  status: TransactionStatus;
  type: TransactionType;
  stellarTxHash?: string;
  stellarLedger?: number;
  failureReason?: string;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Transaction history item
 */
export interface TransactionHistoryItem {
  id: string;
  type: "SENT" | "RECEIVED";
  counterparty: {
    handle: string;
  };
  amount: string;
  status: TransactionStatus;
  stellarTxHash?: string;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Transaction statistics
 */
export interface TransactionStatistics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  totalVolume: string;
  averageAmount: string;
}

/**
 * Transaction filter parameters
 */
export interface TransactionFilter {
  userId?: string;
  status?: TransactionStatus;
  type?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
}

/**
 * Transaction processing result (from worker)
 */
export interface TransactionProcessingResult {
  status: "SUCCESS" | "FAILED";
  hash?: string;
  ledger?: number;
  reason?: string;
}

/**
 * Stellar payment parameters
 */
export interface StellarPaymentParams {
  fromSecretKey: string;
  toPublicKey: string;
  amount: string;
  memo?: string;
}

/**
 * Stellar payment result
 */
export interface StellarPaymentResult {
  hash: string;
  ledger: number;
}

/**
 * Transaction limits
 */
export interface TransactionLimits {
  minAmount: number;
  maxAmount: number;
  dailyLimit: number;
  remainingToday: number;
  transactionCount: number;
}
