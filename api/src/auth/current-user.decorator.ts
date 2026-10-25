import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithUser } from './request-with-user';
import { User } from './users';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
