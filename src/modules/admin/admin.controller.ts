import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { UserService } from "../user/user.service";
import { WalletService } from "../wallet/wallet.service";
import { TransactionService } from "../transaction/transaction.service";
import { AdminService } from "./admin.service";
import { ValidationError } from "../../utils/errors";

const userService = new UserService();
const walletService = new WalletService();
const transactionService = new TransactionService();
const adminService = new AdminService();

// Zod schemas
const listUsersSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 1))
    .pipe(z.number().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 50))
    .pipe(z.number().min(1).max(100)),
  status: z.enum(["ACTIVE", "BLOCKED", "SUSPENDED"]).optional(),
});

const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "BLOCKED", "SUSPENDED"]),
});

const updateWalletStatusSchema = z.object({
  status: z.enum(["ACTIVE", "FROZEN", "CLOSED"]),
});

const getStatisticsSchema = z.object({
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

/**
 * List all users (admin only)
 */
export async function listUsers(
  request: FastifyRequest<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: "ACTIVE" | "BLOCKED" | "SUSPENDED";
    };
  }>,
  reply: FastifyReply,
) {
  const result = listUsersSchema.safeParse(request.query);

  if (!result.success) {
    throw new ValidationError("Invalid query parameters", {
      errors: result.error.issues,
    });
  }

  const { users, total } = await userService.listUsers({
    page: result.data.page,
    limit: result.data.limit,
    status: result.data.status,
  });

  return reply.send({
    success: true,
    data: {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        handle: user.handle,
        status: user.status,
        role: user.role,
        walletStatus: (user as any).wallet.status,
        balance: (user as any).wallet?.balance.toString(),
        createdAt: user.createdAt,
      })),
      pagination: {
        page: result.data.page,
        limit: result.data.limit,
        total,
        totalPages: Math.ceil(total / result.data.limit),
      },
    },
  });
}

/**
 * Update user status (block/unblock) (admin only)
 */
export async function updateUserStatus(
  request: FastifyRequest<{
    Params: { userId: string };
    Body: { status: "ACTIVE" | "BLOCKED" | "SUSPENDED" };
  }>,
  reply: FastifyReply,
) {
  const { userId } = request.params;
  const result = updateUserStatusSchema.safeParse(request.body);

  if (!result.success) {
    throw new ValidationError("Invalid status", {
      errors: result.error.issues,
    });
  }

  const user = await userService.updateUserStatus(userId, result.data.status);

  return reply.send({
    success: true,
    data: {
      userId: user.id,
      status: user.status,
      message: `User status updated to ${user.status}`,
    },
  });
}

/**
 * Update wallet status (freeze/unfreeze) (admin only)
 */
export async function updateWalletStatus(
  request: FastifyRequest<{
    Params: { walletId: string };
    Body: { status: "ACTIVE" | "FROZEN" | "CLOSED" };
  }>,
  reply: FastifyReply,
) {
  const { walletId } = request.params;
  const result = updateWalletStatusSchema.safeParse(request.body);

  if (!result.success) {
    throw new ValidationError("Invalid status", {
      errors: result.error.issues,
    });
  }

  const wallet = await walletService.updateWalletStatus(
    walletId,
    result.data.status,
  );

  return reply.send({
    success: true,
    data: {
      walletId: wallet.id,
      status: wallet.status,
      message: `Wallet status updated to ${wallet.status}`,
    },
  });
}

/**
 * Get transaction statistics (admin only)
 */
export async function getStatistics(
  request: FastifyRequest<{
    Querystring: {
      startDate?: string;
      endDate?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const result = getStatisticsSchema.safeParse(request.query);

  if (!result.success) {
    throw new ValidationError("Invalid query parameters", {
      errors: result.error.issues,
    });
  }

  const [txStats, systemOverview] = await Promise.all([
    transactionService.getStatistics({
      startDate: result.data.startDate,
      endDate: result.data.endDate,
    }),
    adminService.getSystemOverview(),
  ]);

  return reply.send({
    success: true,
    data: {
      transactions: txStats,
      system: systemOverview,
    },
  });
}

/**
 * Get system overview (admin only)
 */
export async function getSystemOverview(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const overview = await adminService.getSystemOverview();

  return reply.send({
    success: true,
    data: overview,
  });
}
