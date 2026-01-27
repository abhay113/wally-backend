import { Transaction, TransactionStatus, Prisma } from "@prisma/client";
import { transactionQueue } from "./transaction.queue";
import { config } from "../../config";
import { WalletService } from "../wallet/wallet.service";
import { UserService } from "../user/user.service";
import {
  NotFoundError,
  InsufficientBalanceError,
  WalletFrozenError,
  UserBlockedError,
  ValidationError,
  LimitExceededError,
} from "../../utils/errors";
import { prisma } from "../../utils/prisma";

export class TransactionService {
  private walletService: WalletService;
  private userService: UserService;

  constructor() {
    this.walletService = new WalletService();
    this.userService = new UserService();
  }

  /**
   * Initiate a P2P payment
   * Creates transaction record and enqueues for processing
   * This is THE MAIN ENTRY POINT for payments
   */
  async sendPayment(params: {
    senderUserId: string;
    recipientHandle: string;
    amount: string;
    idempotencyKey?: string;
  }): Promise<Transaction> {
    const { senderUserId, recipientHandle, amount, idempotencyKey } = params;

    console.log(
      `→ Payment request: ${senderUserId} → @${recipientHandle} (${amount} XLM)`,
    );

    // ========================================
    // STEP 1: Validate Amount
    // ========================================
    const amountNum = parseFloat(amount);
    if (
      isNaN(amountNum) ||
      amountNum <= 0 ||
      amountNum < config.limits.transaction.minAmount ||
      amountNum > config.limits.transaction.maxAmount
    ) {
      throw new ValidationError(
        `Amount must be between ${config.limits.transaction.minAmount} and ${config.limits.transaction.maxAmount} XLM`,
      );
    }

    // ========================================
    // STEP 2: Check Idempotency (Prevent Duplicates)
    // ========================================
    if (idempotencyKey) {
      const existing = await prisma.transaction.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        console.log(
          `✓ Idempotent request, returning existing transaction: ${existing.id}`,
        );
        return existing;
      }
    }

    // ========================================
    // STEP 3: Get Users
    // ========================================
    const [sender, recipient] = await Promise.all([
      this.userService.getUserById(senderUserId),
      this.userService.getUserByHandle(recipientHandle),
    ]);

    // ========================================
    // STEP 4: Validate Users
    // ========================================

    // Cannot send to self
    if (sender.id === recipient.id) {
      throw new ValidationError("Cannot send payment to yourself");
    }

    // Check sender status
    if (sender.status === "BLOCKED") {
      throw new UserBlockedError(sender.id);
    }

    // Check recipient status
    if (recipient.status === "BLOCKED") {
      throw new UserBlockedError(recipient.id);
    }

    // ========================================
    // STEP 5: Get Wallets
    // ========================================
    const [senderWallet, recipientWallet] = await Promise.all([
      this.walletService.getWalletByUserId(sender.id),
      this.walletService.getWalletByUserId(recipient.id),
    ]);

    // ========================================
    // STEP 6: Validate Wallets
    // ========================================

    // Check sender wallet status
    if (senderWallet.status === "FROZEN") {
      throw new WalletFrozenError(senderWallet.id);
    }

    if (senderWallet.status === "CLOSED") {
      throw new ValidationError("Sender wallet is closed");
    }

    // Check recipient wallet status
    if (recipientWallet.status === "FROZEN") {
      throw new WalletFrozenError(recipientWallet.id);
    }

    if (recipientWallet.status === "CLOSED") {
      throw new ValidationError("Recipient wallet is closed");
    }

    // ========================================
    // STEP 7: Check Balance
    // ========================================
    const senderBalance = parseFloat(senderWallet.balance.toString());
    if (senderBalance < amountNum) {
      throw new InsufficientBalanceError(
        amount,
        senderWallet.balance.toString(),
      );
    }

    // ========================================
    // STEP 8: Check Daily Transaction Limit
    // ========================================
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyTotal = await prisma.transaction.aggregate({
      where: {
        senderId: sender.id,
        createdAt: { gte: today },
        status: { in: ["PENDING", "SUCCESS"] },
      },
      _sum: { amount: true },
    });

    const dailySum = parseFloat(dailyTotal._sum.amount?.toString() || "0");
    if (dailySum + amountNum > config.limits.transaction.dailyLimit) {
      throw new LimitExceededError(
        `Daily transaction limit of ${config.limits.transaction.dailyLimit} XLM exceeded`,
      );
    }

    // ========================================
    // STEP 9: Create Transaction Record (CREATED)
    // ========================================
    const transaction = await prisma.transaction.create({
      data: {
        senderId: sender.id,
        receiverId: recipient.id,
        amount: amountNum,
        type: "P2P_SEND",
        status: "CREATED",
        idempotencyKey,
        metadata: {
          senderHandle: sender.handle,
          recipientHandle: recipient.handle,
        },
      },
    });

    console.log(`✓ Transaction created: ${transaction.id}`);

    // ========================================
    // STEP 10: Enqueue Job to BullMQ
    // ========================================
    await transactionQueue.add(
      "process-transaction",
      { transactionId: transaction.id },
      {
        attempts: config.queue.maxRetries,
        backoff: {
          type: "exponential",
          delay: 2000, // Start with 2 seconds
        },
        removeOnComplete: false, // Keep for auditing
        removeOnFail: false,
      },
    );

    console.log(`✓ Job enqueued for transaction: ${transaction.id}`);

    return transaction;
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<Transaction> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        sender: { select: { id: true, handle: true, email: true } },
        receiver: { select: { id: true, handle: true, email: true } },
      },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction");
    }

    return transaction;
  }

  /**
   * Get user's transaction history
   */
  async getTransactionHistory(params: {
    userId: string;
    page?: number;
    limit?: number;
    status?: TransactionStatus;
  }): Promise<{ transactions: Transaction[]; total: number }> {
    const { userId, page = 1, limit = 50, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      OR: [{ senderId: userId }, { receiverId: userId }],
    };

    if (status) {
      where.status = status;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          sender: { select: { handle: true } },
          receiver: { select: { handle: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, total };
  }

  /**
   * Update transaction status (used by worker)
   * @internal
   */
  async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    metadata?: {
      stellarTxHash?: string;
      stellarLedger?: number;
      failureReason?: string;
    },
  ): Promise<Transaction> {
    const updateData: Prisma.TransactionUpdateInput = {
      status,
    };

    if (metadata?.stellarTxHash) {
      updateData.stellarTxHash = metadata.stellarTxHash;
    }

    if (metadata?.stellarLedger) {
      updateData.stellarLedger = metadata.stellarLedger;
    }

    if (metadata?.failureReason) {
      updateData.failureReason = metadata.failureReason;
    }

    if (status === "SUCCESS" || status === "FAILED") {
      updateData.completedAt = new Date();
    }

    console.log(`→ Updating transaction ${transactionId} to ${status}`);

    return prisma.transaction.update({
      where: { id: transactionId },
      data: updateData,
    });
  }

  /**
   * Increment retry count
   * @internal
   */
  async incrementRetryCount(transactionId: string): Promise<void> {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { retryCount: { increment: 1 } },
    });
  }

  /**
   * Get transaction statistics (admin)
   */
  async getStatistics(params: { startDate?: Date; endDate?: Date }): Promise<{
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    pendingTransactions: number;
    totalVolume: string;
    averageAmount: string;
  }> {
    const { startDate, endDate } = params;

    const where: Prisma.TransactionWhereInput = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, successful, failed, pending, aggregates] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { ...where, status: "SUCCESS" } }),
      prisma.transaction.count({ where: { ...where, status: "FAILED" } }),
      prisma.transaction.count({ where: { ...where, status: "PENDING" } }),
      prisma.transaction.aggregate({
        where: { ...where, status: "SUCCESS" },
        _sum: { amount: true },
        _avg: { amount: true },
      }),
    ]);

    return {
      totalTransactions: total,
      successfulTransactions: successful,
      failedTransactions: failed,
      pendingTransactions: pending,
      totalVolume: aggregates._sum.amount?.toString() || "0",
      averageAmount: aggregates._avg.amount?.toString() || "0",
    };
  }
}
