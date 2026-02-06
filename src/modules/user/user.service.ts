import { UserStatus, Prisma } from "../../generated/client";
import {
  NotFoundError,
  DuplicateHandleError,
  ValidationError,
  InternalServerError,
} from "../../utils/errors";
import { WalletService } from "../wallet/wallet.service";
import { StellarService } from "../stellar/stellar.service";
import { prisma } from "../../utils/prisma";
import logger from "../../utils/logger";

/**
 * User type WITH wallet relation
 */
type UserWithWallet = Prisma.UserGetPayload<{
  include: { wallet: true };
}>;

export class UserService {
  private walletService: WalletService;
  private stellarService: StellarService;

  constructor() {
    this.walletService = new WalletService();
    this.stellarService = new StellarService();
  }

  /**
   * Creates or retrieves a user.
   * On first login, it creates the user, creates the wallet,
   * and then activates the wallet on the Stellar network.
   */
  async findOrCreateUser(params: {
    keycloakId: string;
    email: string;
    handle?: string;
  }): Promise<UserWithWallet> {
    const { keycloakId, email } = params;

    // Check for existing user
    const existingUser = await prisma.user.findUnique({
      where: { keycloakId },
      include: { wallet: true },
    });

    if (existingUser) {
      return existingUser;
    }

    // --- New User Creation and Activation Flow ---
    let handle = params.handle ?? this.generateHandleFromEmail(email);
    let newUser: UserWithWallet;

    logger.info(
      `Creating new user and wallet in DB for keycloakId: ${keycloakId}`,
    );

    while (true) {
      try {
        newUser = await this.createUserWithWallet({
          keycloakId,
          email,
          handle,
        });
        break;
      } catch (error: any) {
        if (error.code === "P2002" && error.meta?.target?.includes("handle")) {
          logger.warn(
            `Handle "${handle}" is taken. Regenerating and retrying.`,
          );
          handle = `${this.generateHandleFromEmail(email)}_${Math.random()
            .toString(36)
            .substring(2, 8)}`;
          continue;
        }
        throw error;
      }
    }

    if (!newUser.wallet) {
      logger.error(
        `CRITICAL: User ${newUser.id} was created without a wallet record.`,
      );
      throw new InternalServerError(
        "User was created but the wallet record is missing.",
      );
    }

    // Activate wallet on Stellar
    logger.info(
      `Activating wallet ${newUser.wallet.stellarPublicKey} for user ${newUser.id}`,
    );

    try {
      await this.stellarService.activateAccount(
        newUser.wallet.stellarPublicKey,
      );
    } catch (activationError) {
      const errorDetails =
        activationError instanceof Error
          ? activationError.message
          : JSON.stringify(activationError);

      logger.error(
        `CRITICAL: Failed to activate wallet for user ${newUser.id}. Error: ${errorDetails}`,
      );

      throw new InternalServerError(
        "User account was created, but failed to activate the wallet on the network. Please contact support.",
      );
    }

    return newUser;
  }

  /**
   * Creates user and wallet in a transaction
   */
  private async createUserWithWallet(params: {
    keycloakId: string;
    email: string;
    handle: string;
  }): Promise<UserWithWallet> {
    const { keycloakId, email, handle } = params;

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          keycloakId,
          email,
          handle,
          role: "USER",
          status: "ACTIVE",
        },
      });

      await this.walletService.createWallet(user.id, tx);

      return tx.user.findUnique({
        where: { id: user.id },
        include: { wallet: true },
      }) as Promise<UserWithWallet>;
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<UserWithWallet> {
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
  async getUserByKeycloakId(keycloakId: string): Promise<UserWithWallet> {
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
  async getUserByHandle(handle: string): Promise<UserWithWallet> {
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
  async updateHandle(
    userId: string,
    newHandle: string,
  ): Promise<UserWithWallet> {
    if (!this.isValidHandle(newHandle)) {
      throw new ValidationError(
        "Handle must be 3-30 characters, alphanumeric with underscores only",
      );
    }

    const existing = await prisma.user.findUnique({
      where: { handle: newHandle },
    });

    if (existing && existing.id !== userId) {
      throw new DuplicateHandleError(newHandle);
    }

    return prisma.user.update({
      where: { id: userId },
      data: { handle: newHandle },
      include: { wallet: true },
    });
  }

  /**
   * Block/unblock user
   */
  async updateUserStatus(
    userId: string,
    status: UserStatus,
  ): Promise<UserWithWallet> {
    return prisma.user.update({
      where: { id: userId },
      data: { status },
      include: { wallet: true },
    });
  }

  /**
   * List users (admin only)
   */
  async listUsers(params: {
    page?: number;
    limit?: number;
    status?: UserStatus;
  }): Promise<{ users: UserWithWallet[]; total: number }> {
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
