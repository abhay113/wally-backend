/**
 * Authentication and authorization type definitions
 */

/**
 * User roles in the system
 */
export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
}

/**
 * Authenticated user information attached to request
 */
export interface AuthenticatedUser {
  keycloakId: string;
  email?: string;
  username?: string;
  roles: string[];
}

/**
 * JWT payload structure from Keycloak
 */
export interface KeycloakJWTPayload {
  sub: string; // Subject (Keycloak user ID)
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  name?: string;

  // Roles
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [key: string]: {
      roles: string[];
    };
  };

  // Token metadata
  iss: string; // Issuer
  aud: string | string[]; // Audience
  exp: number; // Expiration time
  iat: number; // Issued at
  auth_time?: number;
  session_state?: string;

  // Custom claims (if any)
  [key: string]: any;
}

/**
 * Token response from Keycloak
 */
export interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  id_token?: string;
  "not-before-policy"?: number;
  session_state?: string;
  scope?: string;
}

/**
 * Permission check result
 */
export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  requiredRoles?: string[];
  userRoles?: string[];
}

/**
 * Authentication error types
 */
export enum AuthErrorType {
  MISSING_TOKEN = "MISSING_TOKEN",
  INVALID_TOKEN = "INVALID_TOKEN",
  EXPIRED_TOKEN = "EXPIRED_TOKEN",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  USER_BLOCKED = "USER_BLOCKED",
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  clientSecret?: string;
  publicKey?: string;
}

//AI given
export interface AuthContext {
  user: AuthenticatedUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

