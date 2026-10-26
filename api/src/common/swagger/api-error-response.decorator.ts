import { ApiResponse } from '@nestjs/swagger';

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
