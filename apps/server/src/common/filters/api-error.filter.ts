import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof BusinessException) {
      response.status(exception.getStatus()).json({
        code: exception.code,
        message: exception.message,
        ...(exception.details && { details: exception.details }),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // ValidationPipe: BadRequestException with array message
      if (
        exception instanceof BadRequestException &&
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse &&
        Array.isArray((exceptionResponse as Record<string, unknown>).message)
      ) {
        response.status(status).json({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: {
            errors: (exceptionResponse as Record<string, unknown>).message,
          },
        });
        return;
      }

      const code = this.httpStatusToCode(exception, status);
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message ?? exception.message;

      response.status(status).json({ code, message });
      return;
    }

    // Unknown exception — 500
    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : exception);
    response.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }

  private httpStatusToCode(exception: HttpException, status: number): string {
    if (exception instanceof BadRequestException) return 'BAD_REQUEST';
    if (exception instanceof UnauthorizedException) return 'UNAUTHORIZED';
    if (exception instanceof ForbiddenException) return 'FORBIDDEN';
    if (exception instanceof NotFoundException) return 'NOT_FOUND';
    if (exception instanceof ConflictException) return 'CONFLICT';
    return `HTTP_${status}`;
  }
}
