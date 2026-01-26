import Redis from "ioredis";
import { config } from "./index";

/**
 * Redis connection for BullMQ
 * Shared between queue (API) and worker
 */
export const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

// Log connection status
redisConnection.on("connect", () => {
  console.log("✓ Redis connected");
});

redisConnection.on("error", (err) => {
  console.error("✗ Redis error:", err);
});

redisConnection.on("close", () => {
  console.log("✓ Redis connection closed");
});
