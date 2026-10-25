import { Role } from './role.enum';

export interface User {
  id: string;
  role: Role;
}

/**
 * Pas d'authentification réelle demandée par le sujet : les utilisateurs et
 * leur rôle sont codés en dur, identifiés par l'en-tête X-User-Id.
 */
export const USERS: Record<string, Role> = {
  diane: Role.DISPATCHER,
  eric: Role.LOGISTICS_MANAGER,
};
