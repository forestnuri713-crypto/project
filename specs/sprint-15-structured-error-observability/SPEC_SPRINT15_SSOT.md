# Sprint 15 — Structured Error & Observability (SSOT)

> SSOT location: `specs/sprint-15-structured-error-observability/SPEC_SPRINT15_SSOT.md` (single source of truth)

Baseline: tag `sprint-14-complete`

---

## 1. Goal

Standardise backend error responses and introduce request-level observability
before Phase 5 (Admin Dashboard UI).

**Topics:**

| # | Topic | Status |
|---|-------|--------|
| 1 | `unified-error-envelope` | Pending |
| 2 | `request-id-propagation` | Done |

---

## 2. Non-goals

- No DB schema changes
- No business logic changes
- No frontend implementation
- No external logging service integration (Datadog, Sentry, etc.)
- No change to `BusinessException` constructor signature

---

## 3. Current State (Audit)

### 3.1 Error Handling Stack

| Component | Location | Role |
|-----------|----------|------|
| `BusinessException` | `src/common/exceptions/business.exception.ts` | Domain error with `code`, `message`, `statusCode`, optional `details` |
| `ApiErrorFilter` | `src/common/filters/api-error.filter.ts` | Global `@Catch()` filter — formats all errors |
| `ValidationPipe` | `src/main.ts` | Transforms + validates DTOs, throws `BadRequestException` |

### 3.2 Current Error Response Shapes (inconsistent)

**BusinessException:**
```json
{ "code": "CAPACITY_EXCEEDED", "message": "잔여석이 부족합니다" }
```

**ValidationPipe (BadRequestException with array):**
```json
{ "code": "VALIDATION_ERROR", "message": "Validation failed", "details": { "errors": [...] } }
```

**Other HttpException:**
```json
{ "code": "NOT_FOUND", "message": "..." }
```

**Unhandled (500):**
```json
{ "code": "INTERNAL_ERROR", "message": "Internal server error" }
```

### 3.3 Gaps

- No `success` field — clients cannot reliably distinguish error vs success by shape
- No `requestId` — impossible to correlate client errors with server logs
- No request-scoped logging context — all logs are service-level only
- 10 services use `new Logger(ClassName.name)` (NestJS built-in); no structured fields
- 31 `BusinessException` throw sites across 6 services

---

## 4. Topics

### Topic 1 — unified-error-envelope (Pending)

**Target error shape (all errors):**

```json
{
  "success": false,
  "error": {
    "code": "CAPACITY_EXCEEDED",
    "message": "잔여석이 부족합니다",
    "requestId": "req_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

With optional `details` when present (validation errors, etc.):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "requestId": "req_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "details": { "errors": ["field X is required"] }
  }
}
```

**Scope:**

- Modify `ApiErrorFilter` to wrap all error responses in `{ success: false, error: { ... } }`
- Include `requestId` from `req.requestId` (set by Topic 2 middleware)
- Keep existing `code`/`message`/`details` fields intact inside `error` object
- No changes to `BusinessException` class itself
- Log `requestId` + `code` on every error response

**Backward compatibility note:**

This is a **breaking envelope change** — existing clients reading `res.code`
must now read `res.error.code`. Since Phase 5 frontend has not started, this
is the optimal time to make this change.

### Topic 2 — request-id-propagation (Done)

**Scope:**

- `RequestIdMiddleware`: check incoming `X-Request-Id` header; if absent, generate `req_<crypto.randomUUID()>`; attach to `req.requestId`; set `X-Request-Id` response header
- `RequestIdInterceptor`: log request start (`→ METHOD /url [requestId]`) and end (`← METHOD /url status durationMs [requestId]`)
- Express `Request` type extended with `requestId: string` (`src/types/express.d.ts`)
- Middleware registered in `AppModule.configure()` for all routes
- Interceptor registered globally in `main.ts`

**Implementation:** Uses Node.js built-in `crypto.randomUUID()` — no new dependency.

**Request lifecycle:**

```
Client → [RequestIdMiddleware: assign/propagate X-Request-Id]
       → [RequestIdInterceptor: log start]
       → Controller → Service → ...
       → [RequestIdInterceptor: log end with duration]
       → [ApiErrorFilter: include requestId in error envelope (Topic 1)]
       → Client (X-Request-Id header + requestId in body on error)
```

---

## 5. Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Wrap errors in `{ success: false, error: { ... } }` | Unambiguous error detection by shape; aligns with common API conventions |
| D2 | Breaking envelope change now (pre-Phase 5) | No frontend consumers yet; cleanest migration window |
| D3 | `X-Request-Id` header (industry standard) | Compatible with load balancers, API gateways, and browser DevTools |
| D4 | `req_<crypto.randomUUID()>` format | No new dependency; `req_` prefix distinguishes from other IDs |
| D5 | Middleware for requestId, Interceptor for logging | Middleware runs earliest (before guards); Interceptor wraps handler for timing |
| D6 | No change to `BusinessException` constructor | 31 throw sites across 6 services; avoid churn; requestId injected at filter level |
| D7 | NestJS built-in Logger (no Pino/Winston) | Sufficient for current scale; avoids new dependency; can upgrade later |

---

## 6. Affected Files

### Topic 1 — unified-error-envelope

| File | Change |
|------|--------|
| `src/common/filters/api-error.filter.ts` | Wrap all responses in `{ success, error }` envelope; include `requestId` |

### Topic 2 — request-id-propagation

| File | Change |
|------|--------|
| `src/common/middleware/request-id.middleware.ts` | New — generate/propagate X-Request-Id |
| `src/common/interceptors/request-id.interceptor.ts` | New — log request start/end with requestId + duration |
| `src/types/express.d.ts` | New — extend Express Request with `requestId` |
| `src/app.module.ts` | Register `RequestIdMiddleware` via `configure()` |
| `src/main.ts` | Register `RequestIdInterceptor` globally |

### Tests

| File | Change |
|------|--------|
| `test/error-envelope.spec.ts` | Pending — verify envelope shape for all error branches |
| `test/request-id.spec.ts` | Done — 5 test cases |

---

## 7. Test / Verification Plan

### Topic 1 — unified-error-envelope (Pending)

| # | Test Case | Assertion | Status |
|---|-----------|-----------|--------|
| T1 | BusinessException | Response has `{ success: false, error: { code, message, requestId } }` | Pending |
| T2 | BusinessException with details | `error.details` included | Pending |
| T3 | ValidationPipe error | `error.code = "VALIDATION_ERROR"`, `error.details.errors` is array | Pending |
| T4 | HttpException (404, 403, etc.) | `error.code` matches `httpStatusToCode` | Pending |
| T5 | Unhandled exception (500) | `error.code = "INTERNAL_ERROR"`, no stack leak | Pending |
| T6 | All error responses include `requestId` | `error.requestId` is string matching `req_` prefix | Pending |

### Topic 2 — request-id-propagation (Done)

| # | Test Case | Assertion | Status |
|---|-----------|-----------|--------|
| T7 | No incoming X-Request-Id | Middleware generates `req_*`, sets response header | PASS |
| T8 | Incoming X-Request-Id | Middleware uses provided value, echoes in response header | PASS |
| T8b | Empty X-Request-Id header | Middleware generates new `req_*` | PASS |
| T9 | Request start logging | Interceptor logs `→ METHOD /url [requestId]` | PASS |
| T10 | Response end logging | Interceptor logs `← METHOD /url status durationMs [requestId]` | PASS |

### Verification commands

```bash
cd apps/server
npx tsc --noEmit          # PASS
npx jest request-id       # 5/5 PASS
```

---

## 8. Risks / Rollback

### Topic 1 — unified-error-envelope

- **Risk:** Breaking change — clients reading `res.code` must migrate to `res.error.code`.
- **Mitigation:** No frontend consumers exist yet (Phase 5 not started). All test suites updated.
- **Rollback:** Revert `ApiErrorFilter` changes to restore flat `{ code, message }` shape.

### Topic 2 — request-id-propagation

- **Risk:** Middleware/interceptor adds latency per request.
- **Mitigation:** `crypto.randomUUID()` is ~1μs; Logger.log is existing cost. Net overhead negligible.
- **Rollback:** Remove middleware from `AppModule.configure()` and interceptor from `main.ts`. Error envelope falls back to `requestId: undefined` (filter handles gracefully).

---

## 9. Rollout Order

1. **CP1:** Topic 2 — `request-id-propagation` (middleware + interceptor + type declaration) ✔
2. **CP2:** Topic 1 — `unified-error-envelope` (filter change — depends on requestId being available)
3. **CP3:** Tests + verification

Topic 2 ships first so that `requestId` is available on `req` when Topic 1's
filter reads it.

---

## 10. Progress

- [x] CP1: request-id-propagation (middleware + interceptor)
- [ ] CP2: unified-error-envelope (ApiErrorFilter)
- [ ] CP3: Tests (error-envelope.spec.ts)
- [x] tsc --noEmit PASS
- [x] jest request-id PASS (5/5)
