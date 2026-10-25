import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { ApiErrorResponse } from './api-error-response.decorator';

/**
 * Documente l'en-tête X-User-Id (auth simulée) et la réponse 401 commune à toutes les routes
 * (CurrentUserGuard est global, voir auth/current-user.guard.ts). À poser sur chaque controller.
 */
export function ApiUserHeader() {
  return applyDecorators(
    ApiHeader({
      name: 'X-User-Id',
      description:
        'Identifiant utilisateur simulé : "diane" (DISPATCHER) ou "eric" (LOGISTICS_MANAGER).',
      required: true,
      example: 'diane',
    }),
    ApiErrorResponse(
      401,
      'UNAUTHENTICATED',
      'En-tête X-User-Id absent ou utilisateur inconnu.',
    ),
  );
}
