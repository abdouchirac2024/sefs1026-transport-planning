import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CurrentUserGuard } from './current-user.guard';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [
    { provide: APP_GUARD, useClass: CurrentUserGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
