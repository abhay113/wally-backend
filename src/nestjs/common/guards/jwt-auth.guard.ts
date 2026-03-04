import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../../../config';
import { UnauthorizedError } from '../../../utils/errors';
import { UserService } from '../../../modules/user/user.service';
import { RequestUser } from '../../types/request-user.type';

interface JWTPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
}

const JWKS = createRemoteJWKSet(
  new URL(`${config.keycloak.authServerUrl}/realms/${config.keycloak.realm}/protocol/openid-connect/certs`),
);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly userService = new UserService();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: RequestUser }>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${config.keycloak.authServerUrl}/realms/${config.keycloak.realm}`,
        audience: ['account', config.keycloak.clientId],
      });

      const jwtPayload = payload as unknown as JWTPayload;
      const realmRoles = jwtPayload.realm_access?.roles || [];
      const clientRoles = jwtPayload.resource_access?.[config.keycloak.clientId]?.roles || [];
      const roles = [...realmRoles, ...clientRoles];

      request.user = {
        keycloakId: jwtPayload.sub,
        email: jwtPayload.email,
        username: jwtPayload.preferred_username,
        roles,
      };

      await this.userService.findOrCreateUser({
        keycloakId: jwtPayload.sub,
        email: jwtPayload.email || 'unknown@example.com',
      });

      return true;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
