import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainError } from '../common/errors/domain-error';
import { ErrorCode } from '../common/errors/error-codes';
import { Role } from './role.enum';
import { ROLES_KEY } from './roles.decorator';
import { RequestWithUser } from './request-with-user';

/**
 * 403 si la route porte @Roles(...) et que l'utilisateur courant n'a pas l'un des rôles requis.
 * Doit s'exécuter après CurrentUserGuard (qui peuple request.user).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!requiredRoles.includes(request.user.role)) {
      throw new DomainError(
        ErrorCode.FORBIDDEN_ROLE,
        `Le rôle ${request.user.role} ne permet pas cette action.`,
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
