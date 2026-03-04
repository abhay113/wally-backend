import { Controller, Get } from '@nestjs/common';
import { config } from '../../config';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.env,
    };
  }
}
