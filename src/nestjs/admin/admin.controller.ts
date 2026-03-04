import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminService } from '../../modules/admin/admin.service';
import { TransactionService } from '../../modules/transaction/transaction.service';
import { UserService } from '../../modules/user/user.service';
import { WalletService } from '../../modules/wallet/wallet.service';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { parseZod } from '../common/utils/zod.util';

const listUsersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  status: z.enum(['ACTIVE', 'BLOCKED', 'SUSPENDED']).optional(),
});
const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'BLOCKED', 'SUSPENDED']) });
const walletStatusSchema = z.object({ status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED']) });
const statsSchema = z.object({
  startDate: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  endDate: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
});

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  private readonly userService = new UserService();
  private readonly walletService = new WalletService();
  private readonly txService = new TransactionService();
  private readonly adminService = new AdminService();

  @Get('users')
  async users(@Query() query: unknown) {
    const parsed = parseZod(listUsersSchema, query);
    const { users, total } = await this.userService.listUsers(parsed);
    return {
      success: true,
      data: {
        users: users.map((user) => ({
          id: user.id,
          email: user.email,
          handle: user.handle,
          status: user.status,
          role: user.role,
          walletStatus: (user as any).wallet.status,
          balance: (user as any).wallet?.balance.toString(),
          createdAt: user.createdAt,
        })),
        pagination: {
          page: parsed.page,
          limit: parsed.limit,
          total,
          totalPages: Math.ceil(total / parsed.limit),
        },
      },
    };
  }

  @Patch('users/:userId/status')
  async userStatus(@Param('userId') userId: string, @Body() body: unknown) {
    const { status } = parseZod(userStatusSchema, body);
    const user = await this.userService.updateUserStatus(userId, status);
    return { success: true, data: { userId: user.id, status: user.status, message: `User status updated to ${user.status}` } };
  }

  @Patch('wallets/:walletId/status')
  async walletStatus(@Param('walletId') walletId: string, @Body() body: unknown) {
    const { status } = parseZod(walletStatusSchema, body);
    const wallet = await this.walletService.updateWalletStatus(walletId, status);
    return { success: true, data: { walletId: wallet.id, status: wallet.status, message: `Wallet status updated to ${wallet.status}` } };
  }

  @Get('statistics')
  async statistics(@Query() query: unknown) {
    const parsed = parseZod(statsSchema, query);
    const [transactions, system] = await Promise.all([
      this.txService.getStatistics(parsed),
      this.adminService.getSystemOverview(),
    ]);
    return { success: true, data: { transactions, system } };
  }

  @Get('overview')
  async overview() {
    const overview = await this.adminService.getSystemOverview();
    return { success: true, data: overview };
  }
}
