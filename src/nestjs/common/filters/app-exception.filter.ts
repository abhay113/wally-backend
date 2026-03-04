import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AppError } from '../../../utils/errors';
import { config } from '../../../config';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof AppError) {
      response.status(exception.httpStatus).json({
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          metadata: exception.metadata,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json({
        success: false,
        error: {
          code: 'HTTP_EXCEPTION',
          message: exception.message,
        },
      });
      return;
    }

    this.logger.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: config.isDevelopment && exception instanceof Error ? exception.message : 'An unexpected error occurred',
      },
    });
  }
}
