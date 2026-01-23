import { buildApp } from "./app";
import { config } from "./config";
import { PrismaClient } from './generated/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export { prisma };



async function start() {
  try {
    // Build Fastify app
    const app = await buildApp();

    // Test database connection
    await prisma.$connect();
    app.log.info("Database connected successfully");

    // Start server
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });

    app.log.info(
      `Server listening on ${config.server.host}:${config.server.port}`,
    );
    app.log.info(`Environment: ${config.env}`);
    app.log.info(`Stellar Network: ${config.stellar.network}`);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);

  try {
    const app = await buildApp();
    await app.close();
    await prisma.$disconnect();
    console.log("Server closed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
