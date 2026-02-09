import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import { config } from "./config";
import { AppError } from "./utils/errors";
import {
  authenticateJWT,
  requireAuth,
  requireAdmin,
} from "./middleware/auth.middleware";

// Import controllers
import * as authController from "./modules/auth/auth.controller";
import * as userController from "./modules/user/user.controller";
import * as walletController from "./modules/wallet/wallet.controller";
import * as transactionController from "./modules/transaction/transaction.controller";
import * as adminController from "./modules/admin/admin.controller";

const fastify = Fastify({
  logger: {
    level: config.isDevelopment ? "debug" : "info",
    transport: config.isDevelopment
      ? {
          target: "pino-pretty",
          options: {
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  },
});

// Register plugins
async function registerPlugins() {
  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for development
  });

  // CORS
  await fastify.register(cors, {
    origin: config.isDevelopment
      ? "*"
      : process.env.ALLOWED_ORIGINS?.split(","),
    credentials: true,
  });
}

// Error handler
fastify.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.httpStatus).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        metadata: error.metadata,
      },
    });
  }

  // Log unexpected errors
  fastify.log.error(error);

  return reply.status(500).send({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: config.isDevelopment
        ? (error as Error).message
        : "An unexpected error occurred",
    },
  });
});

// Register routes
async function registerRoutes() {
  // Health check (public)
  fastify.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: config.env,
    };
  });

  // Public auth routes (no authentication required)

  fastify.register(
    async (auth) => {
      auth.post("/register", authController.registerUser);
      auth.post("/login", authController.login);
      auth.post("/refresh", authController.refreshToken);
      auth.post("/logout", authController.logout);
    },
    { prefix: "/api/v1/auth" },
  );

  // API v1 routes
  fastify.register(
    async (api) => {
      // User routes
      api.register(
        async (userRoutes) => {
          userRoutes.addHook("onRequest", authenticateJWT);
          userRoutes.addHook("onRequest", requireAuth);

          userRoutes.get("/me", userController.getCurrentUser);
          userRoutes.get("/:handle", userController.getUserByHandle);
          userRoutes.patch("/handle", userController.updateHandle);
        },
        { prefix: "/users" },
      );

      // Wallet routes
      api.register(
        async (walletRoutes) => {
          walletRoutes.addHook("onRequest", authenticateJWT);
          walletRoutes.addHook("onRequest", requireAuth);

          walletRoutes.get("/balance", walletController.getBalance);
          walletRoutes.post("/fund", walletController.fundWallet);
          walletRoutes.post("/sync", walletController.syncBalance);
        },
        { prefix: "/wallet" },
      );

      // Transaction routes
      api.register(
        async (txRoutes) => {
          txRoutes.addHook("onRequest", authenticateJWT);
          txRoutes.addHook("onRequest", requireAuth);

          txRoutes.post("/send", transactionController.sendPayment);
          txRoutes.get("/history", transactionController.getTransactionHistory);
          txRoutes.get("/:id", transactionController.getTransaction);
        },
        { prefix: "/transactions" },
      );

      // Admin routes
      api.register(
        async (adminRoutes) => {
          adminRoutes.addHook("onRequest", authenticateJWT);
          adminRoutes.addHook("onRequest", requireAdmin);

          adminRoutes.get("/users", adminController.listUsers);
          adminRoutes.patch(
            "/users/:userId/status",
            adminController.updateUserStatus,
          );
          adminRoutes.patch(
            "/wallets/:walletId/status",
            adminController.updateWalletStatus,
          );
          adminRoutes.get("/statistics", adminController.getStatistics);
          adminRoutes.get("/overview", adminController.getSystemOverview);
        },
        { prefix: "/admin" },
      );
    },
    { prefix: "/api/v1" },
  );
}

// Initialize app
export async function buildApp() {
  await registerPlugins();
  await registerRoutes();
  return fastify;
}

export default fastify;
