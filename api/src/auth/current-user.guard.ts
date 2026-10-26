import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { DomainError } from '../common/errors/domain-error';
import { ErrorCode } from '../common/errors/error-codes';
import { RequestWithUser } from './request-with-user';
import { USERS } from './users';

@Injectable()
export class CurrentUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.header('X-User-Id');
    const role = userId ? USERS[userId] : undefined;

    if (!userId || !role) {
      throw new DomainError(
        ErrorCode.UNAUTHENTICATED,
        'En-tête X-User-Id absent ou utilisateur inconnu.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    request.user = { id: userId, role };
    return true;
  }
}
