import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, UnauthorizedError } from '../../../utils/errors';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../../types/request-user.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!request.user) {
      throw new UnauthorizedError('User not authenticated');
    }

    const hasRole = requiredRoles.some((role) => request.user!.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenError(`Required role: ${requiredRoles.join(' or ')}`, {
        userRoles: request.user.roles,
        requiredRoles,
      });
    }

    return true;
  }
}
