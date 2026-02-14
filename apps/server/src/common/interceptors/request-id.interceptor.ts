import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl, requestId } = req;
    const start = Date.now();

    this.logger.log(`→ ${method} ${originalUrl} [${requestId}]`);

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const duration = Date.now() - start;
        this.logger.log(
          `← ${method} ${originalUrl} ${res.statusCode} ${duration}ms [${requestId}]`,
        );
      }),
    );
  }
}
