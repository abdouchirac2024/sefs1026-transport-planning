import { ApiResponse } from '@nestjs/swagger';

/**
 * Exemple de réponse d'erreur pour Swagger, dans le format unique de l'API
 * ({ statusCode, code, message, details? }) -- voir common/errors/domain-error.ts.
 */
export function ApiErrorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return ApiResponse({
    status,
    description: `${code} — ${message}`,
    schema: {
      example: {
        statusCode: status,
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
  });
}
