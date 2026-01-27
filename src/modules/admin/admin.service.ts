import { prisma } from "../../utils/prisma";
export class AdminService {
  /**
   * Get system overview statistics
   */
  async getSystemOverview(): Promise<{
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    totalWallets: number;
    activeWallets: number;
    frozenWallets: number;
  }> {
    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      totalWallets,
      activeWallets,
      frozenWallets,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "BLOCKED" } }),
      prisma.wallet.count(),
      prisma.wallet.count({ where: { status: "ACTIVE" } }),
      prisma.wallet.count({ where: { status: "FROZEN" } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      blockedUsers,
      totalWallets,
      activeWallets,
      frozenWallets,
    };
  }

  /**
   * Get recent activity logs (optional enhancement)
   */
  async getRecentActivity(limit: number = 50) {
    return prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            handle: true,
            email: true,
          },
        },
      },
    });
  }
}
