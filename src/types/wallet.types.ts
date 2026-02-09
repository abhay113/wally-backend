/**
 * Wallet-related type definitions
 */

import { WalletStatus } from "../generated/client";

/**
 * Wallet balance information
 */
export interface WalletBalance {
  balance: string;
  stellarBalance: string;
  synced: boolean;
}

/**
 * Wallet creation result
 */
export interface WalletCreationResult {
  walletId: string;
  stellarPublicKey: string;
  balance: string;
  status: WalletStatus;
}

/**
 * Funding result
 */
export interface FundingResult {
  success: boolean;
  balance: string;
  message: string;
  transactionHash?: string;
}

/**
 * Encrypted wallet data
 */
export interface EncryptedWalletData {
  encryptedSecret: string;
  iv: string;
  authTag?: string;
}

/**
 * Wallet statistics
 */
export interface WalletStatistics {
  totalWallets: number;
  activeWallets: number;
  frozenWallets: number;
  closedWallets: number;
  totalBalance: string;
  averageBalance: string;
}

/**
 * Funding limits
 */
export interface FundingLimits {
  dailyLimit: number;
  perTransactionLimit: number;
  remainingToday: number;
  fundingCount: number;
  maxFundingsPerDay: number;
}

/**
 * Wallet activity
 */
export interface WalletActivity {
  walletId: string;
  lastActivity: Date;
  transactionCount: number;
  totalSent: string;
  totalReceived: string;
}