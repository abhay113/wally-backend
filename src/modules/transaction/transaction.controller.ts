import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { TransactionService } from "./transaction.service";
import { UserService } from "../user/user.service";
import { ValidationError, ForbiddenError } from "../../utils/errors";

const transactionService = new TransactionService();
const userService = new UserService();

// Zod schemas for validation
const sendPaymentSchema = z.object({
  recipientHandle: z.string().min(3).max(30),
  amount: z.string().regex(/^\d+(\.\d{1,7})?$/),
  idempotencyKey: z.string().optional(),
});

const getHistorySchema = z.object({
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
  status: z
    .enum(["CREATED", "PENDING", "SUCCESS", "FAILED", "CANCELLED"])
    .optional(),
});

/**
 * Send payment to another user
 */
export async function sendPayment(
  request: FastifyRequest<{
    Body: {
      recipientHandle: string;
      amount: string;
      idempotencyKey?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const result = sendPaymentSchema.safeParse(request.body);

  if (!result.success) {
    throw new ValidationError("Invalid payment data", {
      errors: result.error.issues,
    });
  }

  const user = await userService.getUserByKeycloakId(request.user.keycloakId);

  const transaction = await transactionService.sendPayment({
    senderUserId: user.id,
    recipientHandle: result.data.recipientHandle,
    amount: result.data.amount,
    idempotencyKey: result.data.idempotencyKey,
  });

  return reply.code(201).send({
    success: true,
    data: {
      transactionId: transaction.id,
      status: transaction.status,
      amount: transaction.amount.toString(),
      recipientHandle: result.data.recipientHandle,
      createdAt: transaction.createdAt,
      message: "Payment initiated. Check status for confirmation.",
    },
  });
}

/**
 * Get transaction by ID
 */
export async function getTransaction(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply,
) {
  const { id } = request.params;
  const user = await userService.getUserByKeycloakId(request.user.keycloakId);

  const transaction = await transactionService.getTransaction(id);

  // Check if user is part of this transaction or is admin
  if (
    transaction.senderId !== user.id &&
    transaction.receiverId !== user.id &&
    !request.user.roles.includes("ADMIN")
  ) {
    throw new ForbiddenError(
      "You do not have permission to view this transaction",
    );
  }

  return reply.send({
    success: true,
    data: {
      id: transaction.id,
      senderId: transaction.senderId,
      receiverId: transaction.receiverId,
      senderHandle: (transaction as any).sender.handle,
      receiverHandle: (transaction as any).receiver.handle,
      amount: transaction.amount.toString(),
      status: transaction.status,
      type: transaction.type,
      stellarTxHash: transaction.stellarTxHash,
      stellarLedger: transaction.stellarLedger,
      failureReason: transaction.failureReason,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
    },
  });
}

/**
 * Get transaction history for current user
 */
export async function getTransactionHistory(
  request: FastifyRequest<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: "CREATED" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
    };
  }>,
  reply: FastifyReply,
) {
  const result = getHistorySchema.safeParse(request.query);

  if (!result.success) {
    throw new ValidationError("Invalid query parameters", {
      errors: result.error.issues,
    });
  }

  const user = await userService.getUserByKeycloakId(request.user.keycloakId);

  const { transactions, total } =
    await transactionService.getTransactionHistory({
      userId: user.id,
      page: result.data.page,
      limit: result.data.limit,
      status: result.data.status,
    });

  return reply.send({
    success: true,
    data: {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.senderId === user.id ? "SENT" : "RECEIVED",
        counterparty:
          tx.senderId === user.id
            ? { handle: (tx as any).receiver.handle }
            : { handle: (tx as any).sender.handle },
        amount: tx.amount.toString(),
        status: tx.status,
        stellarTxHash: tx.stellarTxHash,
        createdAt: tx.createdAt,
        completedAt: tx.completedAt,
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
