import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redisConnection } from "../config/redis";
import { config } from "../config";
import { stellarService } from "../modules/stellar/stellar.service";
import { WalletService } from "../modules/wallet/wallet.service";
import { TransactionService } from "../modules/transaction/transaction.service";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const walletService = new WalletService();
const transactionService = new TransactionService();

interface TransactionJobData {
  transactionId: string;
}

/**
 * Process transaction job
 * This is where the actual Stellar payment happens
 *
 * CRITICAL: This must be ATOMIC and IDEMPOTENT
 */
async function processTransaction(job: Job<TransactionJobData>) {
  const { transactionId } = job.data;

  console.log("\n========================================");
  console.log(`[Worker] Processing transaction ${transactionId}`);
  console.log("========================================");

  try {
    // ========================================
    // STEP 1: Get Transaction with Related Data
    // ========================================
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        sender: { include: { wallet: true } },
        receiver: { include: { wallet: true } },
      },
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // ========================================
    // STEP 2: Check if Already Processed (IDEMPOTENCY)
    // ========================================
    if (transaction.status === "SUCCESS" || transaction.status === "FAILED") {
      console.log(
        `[Worker] Transaction ${transactionId} already processed with status ${transaction.status}`,
      );
      return { status: transaction.status };
    }

    // ========================================
    // STEP 3: Update Status to PENDING
    // ========================================
    await transactionService.updateTransactionStatus(transactionId, "PENDING");

    const senderWallet = transaction.sender.wallet;
    const receiverWallet = transaction.receiver.wallet;

    if (!senderWallet || !receiverWallet) {
      throw new Error("Wallet not found for sender or receiver");
    }

    console.log(`[Worker] Sender: ${senderWallet.stellarPublicKey}`);
    console.log(`[Worker] Receiver: ${receiverWallet.stellarPublicKey}`);
    console.log(`[Worker] Amount: ${transaction.amount} XLM`);

    // ========================================
    // STEP 4: Get Sender's Decrypted Secret Key
    // ========================================
    console.log(`[Worker] Decrypting sender's secret key...`);
    const senderSecretKey = walletService.getDecryptedSecretKey(senderWallet);

    // ========================================
    // STEP 5: Submit Payment to Stellar (ATOMIC OPERATION)
    // ========================================
    console.log(`[Worker] Submitting payment to Stellar network...`);

    const result = await stellarService.sendPayment({
      fromSecretKey: senderSecretKey,
      toPublicKey: receiverWallet.stellarPublicKey,
      amount: transaction.amount.toString(),
      memo: transactionId, // Use transaction ID as memo for tracking
    });

    console.log(`[Worker] ✓ Stellar transaction successful!`);
    console.log(`[Worker] Transaction Hash: ${result.hash}`);
    console.log(`[Worker] Ledger: ${result.ledger}`);

    // ========================================
    // STEP 6: Update Transaction to SUCCESS
    // ========================================
    await transactionService.updateTransactionStatus(transactionId, "SUCCESS", {
      stellarTxHash: result.hash,
      stellarLedger: result.ledger,
    });

    // ========================================
    // STEP 7: Sync Wallet Balances from Stellar
    // ========================================
    console.log(`[Worker] Syncing wallet balances...`);

    await Promise.all([
      walletService.syncBalance(senderWallet.id),
      walletService.syncBalance(receiverWallet.id),
    ]);

    console.log(
      `[Worker] ✓ Transaction ${transactionId} completed successfully`,
    );
    console.log("========================================\n");

    return {
      status: "SUCCESS",
      hash: result.hash,
      ledger: result.ledger,
    };
  } catch (error) {
    console.error(`[Worker] ✗ Transaction ${transactionId} failed:`, error);

    // ========================================
    // STEP 8: Handle Failure
    // ========================================

    // Increment retry count
    await transactionService.incrementRetryCount(transactionId);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check if we've exceeded max retries
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (transaction && transaction.retryCount >= config.queue.maxRetries - 1) {
      // Mark as FAILED after max retries
      console.log(
        `[Worker] Max retries (${config.queue.maxRetries}) exceeded for transaction ${transactionId}`,
      );

      await transactionService.updateTransactionStatus(
        transactionId,
        "FAILED",
        {
          failureReason: `Max retries exceeded. Last error: ${errorMessage}`,
        },
      );

      console.log(`[Worker] Transaction ${transactionId} marked as FAILED`);
      console.log("========================================\n");

      return { status: "FAILED", reason: errorMessage };
    }

    // Rethrow to trigger BullMQ retry
    console.log(
      `[Worker] Retrying transaction ${transactionId} (attempt ${transaction?.retryCount ?? 0 + 1}/${config.queue.maxRetries})...`,
    );
    console.log("========================================\n");

    throw error;
  }
}

// ========================================
// Create Worker
// ========================================
const worker = new Worker<TransactionJobData>(
  "transaction-processing",
  processTransaction,
  {
    connection: redisConnection,
    concurrency: config.queue.concurrency,
  },
);

// ========================================
// Worker Event Handlers
// ========================================

worker.on("completed", (job) => {
  console.log(`[Worker] ✓ Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  if (job) {
    console.error(
      `[Worker] ✗ Job ${job.id} failed after all retries:`,
      err.message,
    );
  }
});

worker.on("error", (err) => {
  console.error("[Worker] Worker error:", err);
});

worker.on("stalled", (jobId) => {
  console.warn(`[Worker] ⚠ Job ${jobId} stalled`);
});

console.log("\n========================================");
console.log("[Worker] Transaction worker started");
console.log(`[Worker] Concurrency: ${config.queue.concurrency}`);
console.log(`[Worker] Max retries: ${config.queue.maxRetries}`);
console.log("========================================\n");

// ========================================
// Graceful Shutdown
// ========================================
process.on("SIGTERM", async () => {
  console.log("\n[Worker] SIGTERM received, shutting down gracefully...");
  await worker.close();
  await redisConnection.quit();
  await prisma.$disconnect();
  console.log("[Worker] Worker closed successfully");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\n[Worker] SIGINT received, shutting down gracefully...");
  await worker.close();
  await redisConnection.quit();
  await prisma.$disconnect();
  console.log("[Worker] Worker closed successfully");
  process.exit(0);
});

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  console.error("[Worker] Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Worker] Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});
