import { Wallet, WalletStatus, Prisma } from "../../generated/client";
import { stellarService } from "../stellar/stellar.service";
import { encryptSecretKey, decryptSecretKey } from "./wallet.crypto";
import {
  NotFoundError,
  WalletFrozenError,
  RateLimitExceededError,
  LimitExceededError,
  InternalServerError,
} from "../../utils/errors";
import { config } from "../../config";

import { prisma } from "../../utils/prisma";

export class WalletService {
  /**
   * Creates a new wallet for a user
   * Generates Stellar keypair and encrypts secret key
   */
  async createWallet(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Wallet> {
    const client = tx || prisma;

    // Generate Stellar keypair
    const { publicKey, secretKey } = stellarService.generateKeypair();

    // Encrypt secret key
    const { encryptedSecret, iv } = encryptSecretKey(secretKey);

    // Create wallet record
    const wallet = await client.wallet.create({
      data: {
        userId,
        stellarPublicKey: publicKey,
        stellarSecretKey: encryptedSecret,
        encryptionIV: iv,
        status: "ACTIVE",
        balance: 0,
      },
    });

    return wallet;
  }

  /**
   * Get wallet by user ID
   */
  async getWalletByUserId(userId: string): Promise<Wallet> {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    return wallet;
  }

  /**
   * Get wallet by Stellar public key
   */
  async getWalletByPublicKey(stellarPublicKey: string): Promise<Wallet> {
    const wallet = await prisma.wallet.findUnique({
      where: { stellarPublicKey },
    });

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    return wallet;
  }

  /**
   * Get decrypted secret key (use with caution)
   */
  getDecryptedSecretKey(wallet: Wallet): string {
    return decryptSecretKey(wallet.stellarSecretKey, wallet.encryptionIV);
  }

  /**
   * Fund wallet using Friendbot (testnet only)
   * Enforces rate limits and daily caps
   */
  async fundWallet(userId: string): Promise<{
    success: boolean;
    balance: string;
    message: string;
  }> {
    const wallet = await this.getWalletByUserId(userId);

    // Check if wallet is frozen
    if (wallet.status === "FROZEN") {
      throw new WalletFrozenError(wallet.id);
    }

    // Check rate limit (max 3 fundings per day)
    const now = new Date();
    const lastResetDate = new Date(wallet.lastResetDate);
    const daysDiff = Math.floor(
      (now.getTime() - lastResetDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let fundingCount = wallet.fundingCount;
    let dailyFundingSum = parseFloat(wallet.dailyFundingSum.toString());

    // Reset daily counters if it's a new day
    if (daysDiff >= 1) {
      fundingCount = 0;
      dailyFundingSum = 0;
    }

    // Check rate limit
    if (fundingCount >= config.limits.funding.rateLimitMax) {
      throw new RateLimitExceededError(
        `Maximum ${config.limits.funding.rateLimitMax} fundings per day exceeded`,
      );
    }

    // Check daily cap (10,000 XLM default)
    const friendbotAmount = 10000; // Friendbot gives 10,000 XLM
    if (dailyFundingSum + friendbotAmount > config.limits.funding.dailyCapXlm) {
      throw new LimitExceededError(
        `Daily funding cap of ${config.limits.funding.dailyCapXlm} XLM exceeded`,
      );
    }

    try {
      // Fund with Friendbot
      await stellarService.fundWithFriendbot(wallet.stellarPublicKey);

      // Wait a bit for the transaction to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get updated balance
      const balance = await stellarService.getBalance(wallet.stellarPublicKey);

      // Update wallet
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: parseFloat(balance),
          lastFundedAt: now,
          fundingCount: fundingCount + 1,
          dailyFundingSum: dailyFundingSum + friendbotAmount,
          lastResetDate: daysDiff >= 1 ? now : wallet.lastResetDate,
        },
      });

      return {
        success: true,
        balance,
        message: "Wallet funded successfully",
      };
    } catch (error) {
      throw new InternalServerError("Failed to fund wallet", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Sync wallet balance with Stellar network
   */
  async syncBalance(walletId: string): Promise<string> {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    const balance = await stellarService.getBalance(wallet.stellarPublicKey);

    await prisma.wallet.update({
      where: { id: walletId },
      data: { balance: parseFloat(balance) },
    });

    return balance;
  }

  /**
   * Update wallet balance (used by transaction service)
   */
  async updateBalance(
    walletId: string,
    newBalance: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx || prisma;

    await client.wallet.update({
      where: { id: walletId },
      data: { balance: parseFloat(newBalance) },
    });
  }

  /**
   * Freeze/unfreeze wallet
   */
  async updateWalletStatus(
    walletId: string,
    status: WalletStatus,
  ): Promise<Wallet> {
    return prisma.wallet.update({
      where: { id: walletId },
      data: { status },
    });
  }

  /**
   * Get wallet balance
   */
  async getBalance(userId: string): Promise<{
    balance: string;
    stellarBalance: string;
    synced: boolean;
  }> {
    const wallet = await this.getWalletByUserId(userId);
    let stellarBalance = await stellarService.getBalance(
      wallet.stellarPublicKey,
    );
    console.log("stellar balance", stellarBalance);

    const dbBalance = parseFloat(wallet.balance.toString()).toFixed(7);
    stellarBalance = parseFloat(stellarBalance).toFixed(7);
    console.log("stellar balance after sync", stellarBalance);

    const synced = dbBalance === stellarBalance;
    if (!synced) {
      console.log(
        `⚠ Balance out of sync - DB: ${dbBalance}, Stellar: ${stellarBalance}`,
      );
    }

    return {
      balance: dbBalance,
      stellarBalance,
      synced,
    };
  }
}
