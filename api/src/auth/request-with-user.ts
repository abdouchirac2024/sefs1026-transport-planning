import { Request } from 'express';
import { User } from './users';

export interface RequestWithUser extends Request {
  user: User;
}
