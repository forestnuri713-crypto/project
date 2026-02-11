import { HttpException } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, statusCode);
  }
}
