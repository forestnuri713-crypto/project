# Dashboard Stats API Contract

## GET /admin/dashboard/stats

Auth: JWT + ADMIN role

Response (direct object, no wrapper envelope on success):
```json
{
  "totalUsers": 120,
  "totalReservations": 450,
  "totalRevenue": 15000000,
  "pendingPrograms": 3,
  "pendingInstructors": 2
}
```

All fields are `number` (integers). `totalRevenue` is in KRW (원).

## Error Envelope

On failure, follows Sprint 15 standard:
```json
{ "success": false, "error": { "code": "...", "message": "...", "requestId": "req_..." } }
```

UI must display `error.code` + `requestId`. Branch on `code`, not `message`.
