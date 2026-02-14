import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { RequestIdInterceptor } from '../src/common/interceptors/request-id.interceptor';
import { of } from 'rxjs';

// ── Helpers ──

function buildReqRes(headers: Record<string, string> = {}) {
  const req: any = {
    headers,
    method: 'GET',
    originalUrl: '/test',
    requestId: undefined,
  };
  const resHeaders: Record<string, string> = {};
  const res: any = {
    setHeader: jest.fn((k: string, v: string) => {
      resHeaders[k] = v;
    }),
    statusCode: 200,
  };
  return { req, res, resHeaders };
}

// ── Middleware Tests ──

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  it('should generate requestId with req_ prefix when no X-Request-Id header', (done) => {
    const { req, res } = buildReqRes();

    middleware.use(req, res, () => {
      expect(req.requestId).toBeDefined();
      expect(req.requestId).toMatch(/^req_/);
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
      done();
    });
  });

  it('should use incoming X-Request-Id header when provided', (done) => {
    const { req, res } = buildReqRes({ 'x-request-id': 'client-123' });

    middleware.use(req, res, () => {
      expect(req.requestId).toBe('client-123');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'client-123');
      done();
    });
  });

  it('should generate new requestId when X-Request-Id header is empty string', (done) => {
    const { req, res } = buildReqRes({ 'x-request-id': '' });

    middleware.use(req, res, () => {
      expect(req.requestId).toMatch(/^req_/);
      done();
    });
  });
});

// ── Interceptor Tests ──

describe('RequestIdInterceptor', () => {
  const interceptor = new RequestIdInterceptor();
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn((interceptor as any).logger, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function buildContext(requestId: string) {
    const req: any = {
      method: 'POST',
      originalUrl: '/api/reservations',
      requestId,
    };
    const res: any = { statusCode: 201 };
    const context: any = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    };
    return context;
  }

  it('should log request start with method, url, and requestId', (done) => {
    const context = buildContext('req_test-start');
    const handler: any = { handle: () => of('result') };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledTimes(2);
        const startLog = logSpy.mock.calls[0][0];
        expect(startLog).toContain('→ POST /api/reservations');
        expect(startLog).toContain('[req_test-start]');
        done();
      },
    });
  });

  it('should log response end with status, duration, and requestId', (done) => {
    const context = buildContext('req_test-end');
    const handler: any = { handle: () => of('result') };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledTimes(2);
        const endLog = logSpy.mock.calls[1][0];
        expect(endLog).toContain('← POST /api/reservations');
        expect(endLog).toContain('201');
        expect(endLog).toMatch(/\d+ms/);
        expect(endLog).toContain('[req_test-end]');
        done();
      },
    });
  });
});
