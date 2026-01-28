import { z } from "zod";
import { USER_STATUS, WALLET_STATUS } from "../../utils/constants";

/**
 * Zod schemas for user-related API validation
 * These validate incoming HTTP request data
 */

// Update user handle
export const updateHandleSchema = z.object({
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(30, "Handle must be at most 30 characters")
    .regex(
      /^[a-z0-9_]+$/i,
      "Handle can only contain letters, numbers, and underscores",
    ),
});

export type UpdateHandleInput = z.infer<typeof updateHandleSchema>;

// Create user (for admin or internal use)
export const createUserSchema = z.object({
  keycloakId: z.string().min(1, "Keycloak ID is required"),
  email: z.string().email("Invalid email format"),
  handle: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/i)
    .optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Update user status (admin only)
export const updateUserStatusSchema = z.object({
  status: z.enum(
    [WALLET_STATUS.ACTIVE, WALLET_STATUS.CLOSED, WALLET_STATUS.FROZEN],
    {
      error: () => ({
        message: "Status must be ACTIVE, BLOCKED, or SUSPENDED",
      }),
    },
  ),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

// List users query parameters (admin only)
export const listUsersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().min(1, "Page must be at least 1")),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(
      z
        .number()
        .min(1, "Limit must be at least 1")
        .max(100, "Limit must be at most 100"),
    ),
  status: z
    .enum([USER_STATUS.ACTIVE, USER_STATUS.BLOCKED, USER_STATUS.SUSPENDED])
    .optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// Get user by handle params
export const getUserByHandleParamsSchema = z.object({
  handle: z.string().min(1, "Handle is required"),
});

export type GetUserByHandleParams = z.infer<typeof getUserByHandleParamsSchema>;

// Update user profile (optional - for future expansion)
export const updateUserProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/)
    .optional(),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
