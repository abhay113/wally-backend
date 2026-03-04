import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { UserService } from '../../modules/user/user.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { parseZod } from '../common/utils/zod.util';
import { RequestUser } from '../types/request-user.type';

const updateHandleSchema = z.object({ handle: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/i) });

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER', 'ADMIN')
export class UserController {
  private readonly userService = new UserService();

  @Get('me')
  async getCurrentUser(@CurrentUser() authUser: RequestUser) {
    const user = await this.userService.getUserByKeycloakId(authUser.keycloakId);
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        status: user.status,
        role: user.role,
        wallet: (user as any).wallet
          ? {
              id: (user as any).wallet.id,
              publicKey: (user as any).wallet.stellarPublicKey,
              balance: (user as any).wallet.balance.toString(),
              status: (user as any).wallet.status,
            }
          : null,
        createdAt: user.createdAt,
      },
    };
  }

  @Get(':handle')
  async getByHandle(@Param('handle') handle: string) {
    const user = await this.userService.getUserByHandle(handle);
    return { success: true, data: { handle: user.handle, status: user.status } };
  }

  @Patch('handle')
  async updateHandle(@CurrentUser() authUser: RequestUser, @Body() body: unknown) {
    const payload = parseZod(updateHandleSchema, body);
    const user = await this.userService.getUserByKeycloakId(authUser.keycloakId);
    const updatedUser = await this.userService.updateHandle(user.id, payload.handle);
    return { success: true, data: { handle: updatedUser.handle } };
  }
}
