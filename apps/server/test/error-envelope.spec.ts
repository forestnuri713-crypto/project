import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiErrorFilter } from '../src/common/filters/api-error.filter';
import { BusinessException } from '../src/common/exceptions/business.exception';

// ── Helpers ──

function buildHost(requestId?: string) {
  let captured: { status: number; body: any } | undefined;

  const response: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn((body: any) => {
      captured = { status: response.status.mock.calls[0][0], body };
    }),
  };

  const request: any = {
    requestId: requestId ?? undefined,
  };

  const host: any = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };

  return {
    host,
    getResult: () => captured!,
  };
}

// ── Tests ──

describe('ApiErrorFilter — unified error envelope', () => {
  const filter = new ApiErrorFilter();

  beforeEach(() => {
    jest.spyOn((filter as any).logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // T1: BusinessException
  it('should wrap BusinessException in { success: false, error: { code, message, requestId } }', () => {
    const { host, getResult } = buildHost('req_abc');
    const ex = new BusinessException('CAPACITY_EXCEEDED', '잔여석이 부족합니다', 400);

    filter.catch(ex, host);

    const { status, body } = getResult();
    expect(status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'CAPACITY_EXCEEDED',
        message: '잔여석이 부족합니다',
        requestId: 'req_abc',
      },
    });
  });

  // T2: BusinessException with details
  it('should include details in error envelope when present', () => {
    const { host, getResult } = buildHost('req_det');
    const ex = new BusinessException('INVARIANT_VIOLATION', 'check failed', 500, {
      schedule: 'sch-1',
    });

    filter.catch(ex, host);

    const { status, body } = getResult();
    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVARIANT_VIOLATION');
    expect(body.error.requestId).toBe('req_det');
    expect(body.error.details).toEqual({ schedule: 'sch-1' });
  });

  // T3: ValidationPipe error (BadRequestException with array message)
  it('should format validation errors with VALIDATION_ERROR code and details.errors', () => {
    const { host, getResult } = buildHost('req_val');
    const ex = new BadRequestException({
      message: ['field must be string', 'field2 required'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(ex, host);

    const { status, body } = getResult();
    expect(status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        requestId: 'req_val',
        details: {
          errors: ['field must be string', 'field2 required'],
        },
      },
    });
  });

  // T4: HttpException (404, 403, etc.)
  it('should map NotFoundException to NOT_FOUND code', () => {
    const { host, getResult } = buildHost('req_404');
    const ex = new NotFoundException('Resource not found');

    filter.catch(ex, host);

    const { status, body } = getResult();
    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe('req_404');
  });

  it('should map ForbiddenException to FORBIDDEN code', () => {
    const { host, getResult } = buildHost('req_403');
    const ex = new ForbiddenException('Access denied');

    filter.catch(ex, host);

    const { status, body } = getResult();
    expect(status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  // T5: Unhandled exception (500) — no stack leak
  it('should return INTERNAL_ERROR for unhandled exceptions without stack leak', () => {
    const { host, getResult } = buildHost('req_500');
    const ex = new Error('unexpected DB failure');

    filter.catch(ex, host);

    const { status, body } = getResult();
    expect(status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: 'req_500',
      },
    });
    // No stack trace in response body
    expect(JSON.stringify(body)).not.toContain('unexpected DB failure');
  });

  // T6: requestId missing (req.requestId not set) — should be null, not crash
  it('should set requestId to null when req.requestId is not set', () => {
    const { host, getResult } = buildHost(); // no requestId
    const ex = new BusinessException('SOME_ERROR', 'test', 400);

    filter.catch(ex, host);

    const { body } = getResult();
    expect(body.success).toBe(false);
    expect(body.error.requestId).toBeNull();
  });
});
