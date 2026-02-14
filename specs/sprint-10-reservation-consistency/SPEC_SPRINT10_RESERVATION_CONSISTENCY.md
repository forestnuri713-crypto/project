# SPEC_SPRINT10_RESERVATION_CONSISTENCY

## Sprint 10 --- Reservation Consistency & Concurrency Hardening

### 1. Objective

Strengthen reservation domain integrity under high concurrency
conditions. No structural refactoring allowed. Must preserve existing
BusinessException + ApiErrorFilter contract.

This sprint ensures: - No overbooking under concurrent requests - Atomic
capacity updates - Safe cancellation with capacity restoration - Refund
integrity aligned with reservation state

------------------------------------------------------------------------

## 2. Hard Constraints

1.  Do NOT redesign module structure.
2.  All errors must use BusinessException(code).
3.  Tests, build, typecheck must pass.
4.  Prisma migrations must be tracked in git.
5.  Existing API contracts must not break.

------------------------------------------------------------------------

## 3. Scope

### 3.1 Capacity Atomicity

Reservation creation must:

-   Run inside Prisma transaction
-   Lock target program schedule row (SELECT FOR UPDATE equivalent if
    supported)
-   Validate remaining capacity
-   Decrement capacity atomically
-   Create reservation

If capacity insufficient: → BusinessException("CAPACITY_EXCEEDED", 400)

------------------------------------------------------------------------

### 3.2 Overbooking Prevention

Concurrent requests for same schedule must not exceed maxCapacity.

Acceptance: - 100 concurrent requests must never produce total reserved
\> maxCapacity

------------------------------------------------------------------------

### 3.3 Cancellation Safety

When reservation is cancelled:

-   Must run inside transaction
-   Restore capacity atomically
-   Prevent double cancellation

If already cancelled: →
BusinessException("RESERVATION_ALREADY_CANCELLED", 400)

------------------------------------------------------------------------

### 3.4 Refund Integrity

Refund logic must:

-   Only execute if reservation status == CONFIRMED
-   Mark reservation status REFUNDED atomically
-   Prevent duplicate refund calls

If already refunded: → BusinessException("ALREADY_REFUNDED", 400)

------------------------------------------------------------------------

### 3.5 Idempotency Protection

Add basic idempotency guard:

-   Prevent duplicate reservation creation via same user + same schedule
    within short window (optional if existing unique constraint present)

------------------------------------------------------------------------

## 4. Required Changes

### 4.1 Reservation Service

-   Wrap createReservation in prisma.\$transaction
-   Wrap cancelReservation in prisma.\$transaction
-   Wrap refund logic in prisma.\$transaction
-   Ensure capacity update + reservation write are atomic

### 4.2 Prisma Layer

If not already present: - Add composite index on (scheduleId, status) -
Ensure capacity field exists on schedule/program_schedule table

Migration required only if missing.

------------------------------------------------------------------------

## 5. Error Codes (New)

-   CAPACITY_EXCEEDED
-   RESERVATION_ALREADY_CANCELLED
-   ALREADY_REFUNDED

All must follow: { code, message, details }

------------------------------------------------------------------------

## 6. Tests

### reservation-concurrency.spec.ts

-   Simulate concurrent creation
-   Assert no overbooking

### reservation-cancel.spec.ts

-   Cancel restores capacity
-   Double cancel throws error

### refund-integrity.spec.ts

-   Refund updates state
-   Double refund throws error

------------------------------------------------------------------------

## 7. Verification

Run:

npx prisma generate pnpm build --filter=server pnpm test --filter=server
pnpm typecheck --filter=server

------------------------------------------------------------------------

## 8. Definition of Done

-   No overbooking possible
-   Capacity always consistent
-   Refund state machine enforced
-   All tests passing
-   No contract changes
