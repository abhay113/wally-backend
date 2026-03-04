import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AuthController } from './auth/auth.controller';
import { UserController } from './user/user.controller';
import { WalletController } from './wallet/wallet.controller';
import { TransactionController } from './transaction/transaction.controller';
import { AdminController } from './admin/admin.controller';

@Module({
  controllers: [
    HealthController,
    AuthController,
    UserController,
    WalletController,
    TransactionController,
    AdminController,
  ],
})
export class AppModule {}
