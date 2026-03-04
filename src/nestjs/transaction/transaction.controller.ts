import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { TransactionService } from '../../modules/transaction/transaction.service';
import { UserService } from '../../modules/user/user.service';
import { ForbiddenError } from '../../utils/errors';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { parseZod } from '../common/utils/zod.util';
import { RequestUser } from '../types/request-user.type';

const sendPaymentSchema = z.object({
  recipientHandle: z.string().min(3).max(30),
  amount: z.string().regex(/^\d+(\.\d{1,7})?$/),
  idempotencyKey: z.string().optional(),
});
const historySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  status: z.enum(['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED']).optional(),
});

@Controller('api/v1/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER', 'ADMIN')
export class TransactionController {
  private readonly txService = new TransactionService();
  private readonly userService = new UserService();

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  async send(@CurrentUser() authUser: RequestUser, @Body() body: unknown) {
    const payload = parseZod(sendPaymentSchema, body);
    const user = await this.userService.getUserByKeycloakId(authUser.keycloakId);
    const tx = await this.txService.sendPayment({ senderUserId: user.id, ...payload });
    return {
      success: true,
      data: {
        transactionId: tx.id,
        status: tx.status,
        amount: tx.amount.toString(),
        recipientHandle: payload.recipientHandle,
        createdAt: tx.createdAt,
        message: 'Payment initiated. Check status for confirmation.',
      },
    };
  }

  @Get('history')
  async history(@CurrentUser() authUser: RequestUser, @Query() query: unknown) {
    const parsed = parseZod(historySchema, query);
    const user = await this.userService.getUserByKeycloakId(authUser.keycloakId);
    const { transactions, total } = await this.txService.getTransactionHistory({ userId: user.id, ...parsed });
    const visibleTransactions = transactions.filter((tx) => tx.senderId === user.id || tx.status === 'SUCCESS');
    return {
      success: true,
      data: {
        transactions: visibleTransactions.map((tx) => ({
          id: tx.id,
          type: tx.senderId === user.id ? 'SENT' : 'RECEIVED',
          counterparty: tx.senderId === user.id ? { handle: (tx as any).receiver.handle } : { handle: (tx as any).sender.handle },
          amount: tx.amount.toString(),
          status: tx.status,
          stellarTxHash: tx.stellarTxHash,
          createdAt: tx.createdAt,
          completedAt: tx.completedAt,
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

  @Get(':id')
  async getById(@CurrentUser() authUser: RequestUser, @Param('id') id: string) {
    const user = await this.userService.getUserByKeycloakId(authUser.keycloakId);
    const tx = await this.txService.getTransaction(id);
    if (tx.senderId !== user.id && tx.receiverId !== user.id && !authUser.roles.includes('ADMIN')) {
      throw new ForbiddenError('You do not have permission to view this transaction');
    }
    return {
      success: true,
      data: {
        id: tx.id,
        senderId: tx.senderId,
        receiverId: tx.receiverId,
        senderHandle: (tx as any).sender.handle,
        receiverHandle: (tx as any).receiver.handle,
        amount: tx.amount.toString(),
        status: tx.status,
        type: tx.type,
        stellarTxHash: tx.stellarTxHash,
        stellarLedger: tx.stellarLedger,
        failureReason: tx.failureReason,
        createdAt: tx.createdAt,
        completedAt: tx.completedAt,
      },
    };
  }
}
