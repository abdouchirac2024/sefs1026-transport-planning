import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../errors/domain-error';
import { ErrorCode } from '../errors/error-codes';

interface ErrorResponseBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Transforme toute exception (DomainError, erreurs Nest, erreurs inattendues)
 * en un format de réponse unique : { statusCode, code, message, details? }.
 * Le "code" est stable dans le temps : le front s'appuie dessus, pas sur "message".
 */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const body = this.toErrorBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown): ErrorResponseBody {
    if (exception instanceof DomainError) {
      return {
        statusCode: exception.httpStatus,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message = this.extractMessage(payload, exception.message);
      return {
        statusCode: status,
        code:
          status === HttpStatus.BAD_REQUEST
            ? ErrorCode.VALIDATION_ERROR
            : 'HTTP_ERROR',
        message,
      };
    }

    this.logger.error(
      'Erreur inattendue',
      exception instanceof Error ? exception.stack : exception,
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur interne est survenue.',
    };
  }

  private extractMessage(payload: unknown, fallback: string): string {
    if (typeof payload === 'string') return payload;
    if (
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      (payload as { message: unknown }).message
    ) {
      const message = (payload as { message: unknown }).message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }
    return fallback;
  }
}
