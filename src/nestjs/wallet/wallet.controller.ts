import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserService } from '../../modules/user/user.service';
import { WalletService } from '../../modules/wallet/wallet.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../types/request-user.type';

@Controller('api/v1/wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER', 'ADMIN')
export class WalletController {
  private readonly walletService = new WalletService();
  private readonly userService = new UserService();

  @Get('balance')
  async getBalance(@CurrentUser() authUser: RequestUser) {
    const user = await this.userService.getUserByKeycloakId(authUser.keycloakId);
    const balanceInfo = await this.walletService.getBalance(user.id);
    return {
      success: true,
      data: {
        ...balanceInfo,
        message: balanceInfo.synced ? 'Balance is in sync with blockchain' : 'Balance may be out of sync. Try syncing.',
      },
    };
  }

  @Post('fund')
  async fundWallet(@CurrentUser() authUser: RequestUser, @Body() body: { amount?: string }) {
    const user = await this.userService.getUserByKeycloakId(authUser.keycloakId);
    const result = await this.walletService.fundWallet(user.id, body?.amount);
    return {
      success: true,
      data: {
        balance: result.balance,
        transactionHash: result.hash,
        message: result.message,
      },
    };
  }

  @Post('sync')
  async syncBalance(@CurrentUser() authUser: RequestUser) {
    const user = await this.userService.getUserByKeycloakId(authUser.keycloakId);
    const wallet = await this.walletService.getWalletByUserId(user.id);
    const balance = await this.walletService.syncBalance(wallet.id);
    return { success: true, data: { balance, message: 'Balance synced successfully' } };
  }
}
