import { api, ApiError } from './api';

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('api client', () => {
  it('parses Sprint 15 error envelope (body.error)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () =>
        Promise.resolve({
          success: false,
          error: {
            code: 'CAPACITY_EXCEEDED',
            message: '잔여석이 부족합니다',
            requestId: 'req_abc123',
          },
        }),
    });

    await expect(api.get('/test')).rejects.toThrow(ApiError);

    try {
      await api.get('/test');
    } catch (e) {
      const err = e as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(400);
      expect(err.message).toBe('잔여석이 부족합니다');
      expect(err.code).toBe('CAPACITY_EXCEEDED');
      expect(err.requestId).toBe('req_abc123');
    }
  });

  it('falls back to body.message when body.error absent (legacy)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () =>
        Promise.resolve({ message: '레거시 에러 메시지' }),
    });

    try {
      await api.get('/test');
    } catch (e) {
      const err = e as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(404);
      expect(err.message).toBe('레거시 에러 메시지');
      expect(err.code).toBeNull();
      expect(err.requestId).toBeNull();
    }
  });

  it('falls back to statusText when json parse fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('invalid json')),
    });

    try {
      await api.get('/test');
    } catch (e) {
      const err = e as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(500);
      expect(err.message).toBe('Internal Server Error');
      expect(err.code).toBeNull();
    }
  });

  it('returns null for 204 No Content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('no body')),
    });

    const result = await api.get('/test');
    expect(result).toBeNull();
  });

  it('returns parsed JSON for successful response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], total: 0 }),
    });

    const result = await api.get<{ items: unknown[]; total: number }>('/test');
    expect(result).toEqual({ items: [], total: 0 });
  });
});
