import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { AuthService } from "./auth.service";
import { ValidationError } from "../../utils/errors";

const authService = new AuthService();

// Zod schemas for validation
const registerSchema = z.object({
  email: z.string().email("Invalid email format"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),

  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(30, "Handle must be at most 30 characters")
    .regex(
      /^[a-z0-9_]+$/i,
      "Handle can only contain letters, numbers, and underscores",
    ),

  firstName: z
    .string()
    .min(1, "First name cannot be empty")
    .max(50, "First name is too long")
    .optional(),

  lastName: z
    .string()
    .min(1, "Last name cannot be empty")
    .max(50, "Last name is too long")
    .optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

/**
 * Register a new user
 * PUBLIC endpoint - no authentication required
 */
export async function registerUser(
  request: FastifyRequest<{
    Body: {
      email: string;
      password: string;
      handle: string;
      firstName?: string;
      lastName?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const result = registerSchema.safeParse(request.body);

  if (!result.success) {
    throw new ValidationError("Invalid registration data", {
      errors: result.error.issues,
    });
  }
  console.log("REQUEST BODY:", request.body);
  console.log("PARSED DATA:", result.data);
  const response = await authService.registerUser(result.data);

  return reply.code(201).send(response);
}

/**
 * Login and get JWT token
 * PUBLIC endpoint - no authentication required
 */
export async function login(
  request: FastifyRequest<{
    Body: {
      email: string;
      password: string;
    };
  }>,
  reply: FastifyReply,
) {
  const result = loginSchema.safeParse(request.body);

  if (!result.success) {
    throw new ValidationError("Invalid login data", {
      errors: result.error.issues,
    });
  }
  console.log("result.data: in login controller", result.data);
  const response = await authService.login(result.data);

  console.log("respone: in login controller", response);
  return reply.send(response);
}

/**
 * Refresh access token
 * PUBLIC endpoint - no authentication required
 */
export async function refreshToken(
  request: FastifyRequest<{
    Body: {
      refreshToken: string;
    };
  }>,
  reply: FastifyReply,
) {
  const result = refreshTokenSchema.safeParse(request.body);

  if (!result.success) {
    throw new ValidationError("Invalid refresh token data", {
      errors: result.error.issues,
    });
  }

  const response = await authService.refreshToken(result.data.refreshToken);

  return reply.send(response);
}

/**
 * Logout (invalidate tokens)
 * PUBLIC endpoint - can be called with refresh token
 */
export async function logout(
  request: FastifyRequest<{
    Body: {
      refreshToken: string;
    };
  }>,
  reply: FastifyReply,
) {
  const result = logoutSchema.safeParse(request.body);

  if (!result.success) {
    throw new ValidationError("Invalid logout data", {
      errors: result.error.issues,
    });
  }

  const response = await authService.logout(result.data.refreshToken);

  return reply.send(response);
}
