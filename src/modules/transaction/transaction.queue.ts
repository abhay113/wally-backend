import { Queue } from "bullmq";
import { redisConnection } from "../../config/redis";

/**
 * Transaction processing queue
 * Jobs are added here by the API and processed by the worker
 */
export const transactionQueue = new Queue("transaction-processing", {
  connection: redisConnection,
});

console.log("✓ Transaction queue initialized");
