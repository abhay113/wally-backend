import axios from "axios";
import { config } from "../../config";
import { UserService } from "../user/user.service";
import {
  ValidationError,
  ConflictError,
  UnauthorizedError,
  InternalServerError,
} from "../../utils/errors";

const userService = new UserService();

export class AuthService {
  /**
   * Get admin access token from Keycloak
   * Used for administrative operations like creating users
   */
  private async getAdminToken(): Promise<string> {
    try {
      const response = await axios.post(
        `${config.keycloak.authServerUrl}/realms/${config.keycloak.realm}/protocol/openid-connect/token`,
        new URLSearchParams({
          grant_type: "client_credentials",
          client_id: config.keycloak.clientId,
          client_secret: config.keycloak.clientSecret,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      return response.data.access_token;
    } catch (error: any) {
      console.log("STATUS:", error.response?.status);
      console.log("DATA:", error.response?.data);
      console.log("HEADERS:", error.response?.headers);
      throw error;
    }
  }

  /**
   * Register a new user in Keycloak and our database
   */
  async register(params: {
    email: string;
    password: string;
    handle: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{
    success: boolean;
    message: string;
  }> {
    const { email, password, handle, firstName, lastName } = params;

    // Validate input
    if (!email || !password || !handle) {
      throw new ValidationError("Email, password, and handle are required");
    }

    if (password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }

    // Check if handle is already taken in our database
    try {
      await userService.getUserByHandle(handle);
      throw new ConflictError(`Handle "${handle}" is already taken`);
    } catch (error) {
      // NotFoundError is expected (handle is available)
      if (error instanceof ConflictError) {
        throw error;
      }
      // Continue if handle not found (good!)
    }

    try {
      // Get admin token
      const adminToken = await this.getAdminToken();

      // Create user in Keycloak
      const createUserResponse = await axios.post(
        `${config.keycloak.authServerUrl}/admin/realms/${config.keycloak.realm}/users`,
        {
          username: handle,
          email,
          firstName: firstName || "Default", // Use handle as default if not provided
          lastName: lastName || "User", // Default to if not provided
          enabled: true,
          emailVerified: false, // Can add email verification flow later
          credentials: [
            {
              type: "password",
              value: password,
              temporary: false,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      // Extract Keycloak user ID from Location header
      const locationHeader = createUserResponse.headers.location;
      if (!locationHeader) {
        throw new InternalServerError("Failed to get Keycloak user ID");
      }

      const keycloakUserId = locationHeader.split("/").pop()!;

      // Assign USER role to the new user
      await this.assignRoleToUser(keycloakUserId, "USER", adminToken);

      // Create user in our database (auto-creates wallet)
      await userService.findOrCreateUser({
        keycloakId: keycloakUserId,
        email,
        handle,
      });

      console.log(`✓ User registered: ${handle} (${keycloakUserId})`);

      return {
        success: true,
        message: "Account created successfully. You can now login.",
      };
    } catch (error: any) {
      // Handle Keycloak-specific errors
      if (error.response?.status === 409) {
        throw new ConflictError("Email or username already exists in Keycloak");
      }

      if (error instanceof ConflictError || error instanceof ValidationError) {
        throw error;
      }

      throw new InternalServerError("Failed to register user", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Assign a role to a user in Keycloak
   */
  private async assignRoleToUser(
    userId: string,
    roleName: string,
    adminToken: string,
  ): Promise<void> {
    try {
      // Get role ID
      const rolesResponse = await axios.get(
        `${config.keycloak.authServerUrl}/admin/realms/${config.keycloak.realm}/roles`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );

      const role = rolesResponse.data.find((r: any) => r.name === roleName);

      if (!role) {
        console.warn(`Role "${roleName}" not found in Keycloak`);
        return;
      }

      // Assign role to user
      await axios.post(
        `${config.keycloak.authServerUrl}/admin/realms/${config.keycloak.realm}/users/${userId}/role-mappings/realm`,
        [{ id: role.id, name: role.name }],
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log(`✓ Assigned role "${roleName}" to user ${userId}`);
    } catch (error) {
      console.error("Failed to assign role:", error);
      // Don"t throw - role assignment is not critical for registration
    }
  }

  /**
   * Login user and get JWT token
   */
  async login(params: { email: string; password: string }): Promise<{
    success: boolean;
    token: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const { email, password } = params;

    if (!email || !password) {
      throw new ValidationError("Email and password are required");
    }

    try {
      const response = await axios.post(
        `${config.keycloak.authServerUrl}/realms/${config.keycloak.realm}/protocol/openid-connect/token`,
        new URLSearchParams({
          client_id: config.keycloak.clientId,
          client_secret: config.keycloak.clientSecret,
          username: email,
          password,
          grant_type: "password",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      console.log(`✓ User logged in: ${email}`);

      return {
        success: true,
        token: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      console.error("Login failed:", error.response?.data || error.message);
      if (error.response?.status === 401) {
        throw new UnauthorizedError("Invalid email or password");
      }

      throw new InternalServerError("Login failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{
    success: boolean;
    token: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    try {
      const response = await axios.post(
        `${config.keycloak.authServerUrl}/realms/${config.keycloak.realm}/protocol/openid-connect/token`,
        new URLSearchParams({
          client_id: config.keycloak.clientId,
          client_secret: config.keycloak.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      return {
        success: true,
        token: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new UnauthorizedError("Invalid or expired refresh token");
      }

      throw new InternalServerError("Token refresh failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Logout user (invalidate tokens)
   */
  async logout(refreshToken: string): Promise<{ success: boolean }> {
    try {
      await axios.post(
        `${config.keycloak.authServerUrl}/realms/${config.keycloak.realm}/protocol/openid-connect/logout`,
        new URLSearchParams({
          client_id: config.keycloak.clientId,
          client_secret: config.keycloak.clientSecret,
          refresh_token: refreshToken,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      return { success: true };
    } catch (error) {
      // Logout failures are not critical
      console.error("Logout error:", error);
      return { success: true }; // Return success anyway
    }
  }
}
