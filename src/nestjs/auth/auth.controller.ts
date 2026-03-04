import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from '../../modules/auth/auth.service';
import { parseZod } from '../common/utils/zod.util';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  handle: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/i),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const refreshTokenSchema = z.object({ refreshToken: z.string().min(1) });

@Controller('api/v1/auth')
export class AuthController {
  private readonly authService = new AuthService();

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: unknown) {
    return this.authService.registerUser(parseZod(registerSchema, body));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown) {
    return this.authService.login(parseZod(loginSchema, body));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: unknown) {
    const payload = parseZod(refreshTokenSchema, body);
    return this.authService.refreshToken(payload.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() body: unknown) {
    const payload = parseZod(refreshTokenSchema, body);
    return this.authService.logout(payload.refreshToken);
  }
}
