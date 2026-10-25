import { SetMetadata } from '@nestjs/common';
import { Role } from './role.enum';

export const ROLES_KEY = 'roles';

/** Déclare les rôles autorisés sur une route. Sans ce décorateur, tout utilisateur authentifié passe. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
