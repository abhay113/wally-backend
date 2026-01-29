import { FastifyRequest, FastifyReply } from "fastify";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { config } from "../config";
import { UnauthorizedError, ForbiddenError } from "../utils/errors";
import { UserService } from "../modules/user/user.service";

const userService = new UserService();

export interface JWTPayload {
  sub: string; // Keycloak user ID
  email?: string;
  preferred_username?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [key: string]: {
      roles: string[];
    };
  };
}

// Extend Fastify request type
declare module "fastify" {
  interface FastifyRequest {
    user: {
      keycloakId: string;
      email?: string;
      username?: string;
      roles: string[];
    };
  }
}

// Create JWKS (JSON Web Key Set) endpoint for Keycloak public keys
const JWKS = createRemoteJWKSet(
  new URL(
    `${config.keycloak.authServerUrl}/realms/${config.keycloak.realm}/protocol/openid-connect/certs`,
  ),
);

/**
 * Validates JWT token from Keycloak and extracts user information
 * Sets request.user with authenticated user details
 */
export async function authenticateJWT(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  try {
    // Verify JWT signature and validate claims
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${config.keycloak.authServerUrl}/realms/${config.keycloak.realm}`,
      audience: ["account", config.keycloak.clientId],
    });

    const jwtPayload = payload as unknown as JWTPayload;

    // Extract roles from realm_access or resource_access
    const realmRoles = jwtPayload.realm_access?.roles || [];
    const clientRoles =
      jwtPayload.resource_access?.[config.keycloak.clientId]?.roles || [];
    const roles = [...realmRoles, ...clientRoles];

    // Set user on request
    request.user = {
      keycloakId: jwtPayload.sub,
      email: jwtPayload.email,
      username: jwtPayload.preferred_username,
      roles,
    };

    // Auto-create user in our system if first time
    try {
      await userService.findOrCreateUser({
        keycloakId: jwtPayload.sub,
        email: jwtPayload.email || "unknown@example.com",
      });
    } catch (error) {
      request.log.error({ err: error }, "Error creating user");
    }
  } catch (error) {
    throw new UnauthorizedError("Invalid or expired token", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Checks if user has at least one of the required roles
 */
export function requireRole(...requiredRoles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError("User not authenticated");
    }

    const hasRole = requiredRoles.some((role) =>
      request.user.roles.includes(role),
    );

    if (!hasRole) {
      throw new ForbiddenError(`Required role: ${requiredRoles.join(" or ")}`, {
        userRoles: request.user.roles,
        requiredRoles,
      });
    }
  };
}

/**
 * Checks if user is admin
 */
export const requireAdmin = requireRole("ADMIN");

/**
 * Checks if user is authenticated (any role)
 */
export const requireAuth = requireRole("USER", "ADMIN");
