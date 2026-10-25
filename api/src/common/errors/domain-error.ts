import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

/**
 * Erreur métier. Portée par les règles pures (domain/*.rules.ts) et les services,
 * transformée en réponse HTTP par DomainErrorFilter.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus: HttpStatus,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
