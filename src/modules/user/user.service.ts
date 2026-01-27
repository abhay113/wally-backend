import { User, UserStatus } from "@prisma/client";
import {
  NotFoundError,
  DuplicateHandleError,
  ValidationError,
} from "../../utils/errors";
import { WalletService } from "../wallet/wallet.service";

import { prisma } from "../../utils/prisma";

export class UserService {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  /**
   * Creates or retrieves user from Keycloak ID
   * Auto-creates wallet on first login
   */
  async findOrCreateUser(params: {
    keycloakId: string;
    email: string;
    handle?: string;
  }): Promise<User> {
    const { keycloakId, email, handle } = params;

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { keycloakId },
      include: { wallet: true },
    });

    if (user) {
      return user;
    }

    // Generate handle if not provided
    const userHandle = handle || this.generateHandleFromEmail(email);

    // Check if handle is taken
    const existingHandle = await prisma.user.findUnique({
      where: { handle: userHandle },
    });

    if (existingHandle) {
      // Auto-append random suffix
      const randomHandle = `${userHandle}_${Math.random().toString(36).substring(2, 8)}`;
      return this.createUserWithWallet({
        keycloakId,
        email,
        handle: randomHandle,
      });
    }

    return this.createUserWithWallet({ keycloakId, email, handle: userHandle });
  }

  /**
   * Creates user and wallet in a transaction
   */
  private async createUserWithWallet(params: {
    keycloakId: string;
    email: string;
    handle: string;
  }): Promise<User> {
    const { keycloakId, email, handle } = params;

    return prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          keycloakId,
          email,
          handle,
          role: "USER",
          status: "ACTIVE",
        },
      });

      // Create wallet for user
      await this.walletService.createWallet(user.id, tx);

      return tx.user.findUnique({
        where: { id: user.id },
        include: { wallet: true },
      }) as Promise<User>;
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { wallet: true },
    });

    if (!user) {
      throw new NotFoundError("User");
    }

    return user;
  }

  /**
   * Get user by Keycloak ID
   */
  async getUserByKeycloakId(keycloakId: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { keycloakId },
      include: { wallet: true },
    });

    if (!user) {
      throw new NotFoundError("User");
    }

    return user;
  }

  /**
   * Get user by handle
   */
  async getUserByHandle(handle: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { handle },
      include: { wallet: true },
    });

    if (!user) {
      throw new NotFoundError("User");
    }

    return user;
  }

  /**
   * Update user handle
   */
  async updateHandle(userId: string, newHandle: string): Promise<User> {
    // Validate handle format
    if (!this.isValidHandle(newHandle)) {
      throw new ValidationError(
        "Handle must be 3-30 characters, alphanumeric with underscores only",
      );
    }

    // Check if handle is taken
    const existing = await prisma.user.findUnique({
      where: { handle: newHandle },
    });

    if (existing && existing.id !== userId) {
      throw new DuplicateHandleError(newHandle);
    }

    return prisma.user.update({
      where: { id: userId },
      data: { handle: newHandle },
    });
  }

  /**
   * Block/unblock user
   */
  async updateUserStatus(userId: string, status: UserStatus): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }

  /**
   * List users (admin only)
   */
  async listUsers(params: {
    page?: number;
    limit?: number;
    status?: UserStatus;
  }): Promise<{ users: User[]; total: number }> {
    const { page = 1, limit = 50, status } = params;
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: { wallet: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * Generate handle from email
   */
  private generateHandleFromEmail(email: string): string {
    const username = email.split("@")[0];
    return username
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .substring(0, 30);
  }

  /**
   * Validate handle format
   */
  private isValidHandle(handle: string): boolean {
    return /^[a-z0-9_]{3,30}$/i.test(handle);
  }
}
