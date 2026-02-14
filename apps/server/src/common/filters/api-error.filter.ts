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
import { Request, Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';

interface ErrorBody {
  code: string;
  message: string;
  requestId: string | null;
  details?: Record<string, unknown>;
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const requestId = request?.requestId ?? null;

    if (exception instanceof BusinessException) {
      const body: ErrorBody = {
        code: exception.code,
        message: exception.message,
        requestId,
        ...(exception.details && { details: exception.details }),
      };
      this.sendError(response, exception.getStatus(), body);
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
        const body: ErrorBody = {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          requestId,
          details: {
            errors: (exceptionResponse as Record<string, unknown>).message,
          },
        };
        this.sendError(response, status, body);
        return;
      }

      const code = this.httpStatusToCode(exception, status);
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message ?? exception.message;

      this.sendError(response, status, {
        code,
        message: String(message),
        requestId,
      });
      return;
    }

    // Unknown exception — 500
    this.logger.error(
      `Unhandled exception [${requestId}]`,
      exception instanceof Error ? exception.stack : exception,
    );
    this.sendError(response, 500, {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId,
    });
  }

  private sendError(response: Response, status: number, error: ErrorBody) {
    response.status(status).json({ success: false, error });
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
