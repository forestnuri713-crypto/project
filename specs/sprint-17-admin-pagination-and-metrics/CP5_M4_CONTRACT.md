# CP5 M4 — Bulk Cancel Job Items API Contract

## GET /admin/bulk-cancel-jobs/:jobId/items

Query params:
- `page` (int, default 1)
- `pageSize` (int, default 20) — NOT `limit`
- `result?` (enum: `SUCCESS` | `FAILED` | `SKIPPED`)

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "reservationId": "uuid",
      "result": "SUCCESS | FAILED | SKIPPED",
      "failureCode": "string | null",
      "failureMessage": "string | null",
      "attemptedAt": "ISO datetime",
      "refundedAmount": "number | null",
      "notificationSent": "boolean",
      "reservation": {
        "id": "uuid",
        "userId": "uuid",
        "totalPrice": "number",
        "status": "string"
      }
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

Error (job not found):
- Code: `BULK_CANCEL_JOB_NOT_FOUND`, HTTP 404

## POST /admin/bulk-cancel-jobs/:jobId/retry

No request body.

Response variants:
1. **Has failed items** → executes retry, returns updated `BulkCancelJob` (same shape as job summary)
2. **No failed items** → returns `{ "message": "재시도할 실패 항목이 없습니다", "jobId": "uuid" }`

Error (job not found):
- Code: `BULK_CANCEL_JOB_NOT_FOUND`, HTTP 404

## Error Envelope

All errors follow Sprint 15 envelope:
```json
{ "success": false, "error": { "code": "...", "message": "...", "requestId": "req_..." } }
```

UI must branch on `error.code`, never `error.message`. Always display `requestId`.
