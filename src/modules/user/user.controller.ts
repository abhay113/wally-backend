import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { UserService } from "./user.service";
import { ValidationError } from "../../utils/errors";

const userService = new UserService();

// Zod schemas
const updateHandleSchema = z.object({
  handle: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/i),
});

/**
 * Get current user profile
 */
export async function getCurrentUser(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = await userService.getUserByKeycloakId(request.user.keycloakId);

  return reply.send({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      handle: user.handle,
      status: user.status,
      role: user.role,
      wallet: user.wallet
        ? {
            id: user.wallet.id,
            publicKey: user.wallet.stellarPublicKey,
            balance: user.wallet.balance.toString(),
            status: user.wallet.status,
          }
        : null,
      createdAt: user.createdAt,
    },
  });
}

/**
 * Get user by handle (public)
 */
export async function getUserByHandle(
  request: FastifyRequest<{
    Params: { handle: string };
  }>,
  reply: FastifyReply,
) {
  const { handle } = request.params;

  const user = await userService.getUserByHandle(handle);

  return reply.send({
    success: true,
    data: {
      handle: user.handle,
      status: user.status,
      // Don't expose sensitive info
    },
  });
}

/**
 * Update user handle
 */
export async function updateHandle(
  request: FastifyRequest<{
    Body: { handle: string };
  }>,
  reply: FastifyReply,
) {
  const result = updateHandleSchema.safeParse(request.body);

  if (!result.success) {
    throw new ValidationError("Invalid handle format", {
      errors: result.error.errors,
    });
  }

  const user = await userService.getUserByKeycloakId(request.user.keycloakId);

  const updatedUser = await userService.updateHandle(
    user.id,
    result.data.handle,
  );

  return reply.send({
    success: true,
    data: {
      handle: updatedUser.handle,
    },
  });
}
