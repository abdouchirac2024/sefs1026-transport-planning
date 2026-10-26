import { Role } from './role.enum';

export interface User {
  id: string;
  role: Role;
}

export const USERS: Record<string, Role> = {
  diane: Role.DISPATCHER,
  eric: Role.LOGISTICS_MANAGER,
};
