import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { ApiErrorResponse } from './api-error-response.decorator';

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
