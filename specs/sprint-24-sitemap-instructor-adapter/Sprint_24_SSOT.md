# Sprint 24 SSOT — Wire sitemap adapter to real instructor list endpoint

> Project: 숲똑 (SoopTalk)  
> Sprint: 24  
> Date: 2026-02-18  
> Baseline: Sprint 22 sitemap foundation (static-only) ✅, Sprint 23 `GET /public/instructors` (APPROVED-only, cursor pagination) ✅  
> Source of truth: `status.md` snapshot (last updated 2026-02-16)

---

## 0) Execution Contract (Non‑negotiable)

**Goal (one sentence):** Replace `instructors.stub.ts` with a real adapter that calls `GET /public/instructors`, and emit instructor URLs in sitemap **without breaking SSR correctness or existing fallback behavior**.

**Hard constraints**
- **No backend changes.** Only frontend / adapter code.
- Must keep sitemap generation stable in:
  - local dev
  - CI build (no secrets)
  - production (envs present)
- Must preserve existing “fallback behavior” (i.e., if remote fetch is unavailable, sitemap still renders with static URLs and does not hard-fail build/runtime).
- Output must include instructor profile URLs (canonical `/instructors/{slug}`) for **APPROVED** instructors only (the endpoint already guarantees this).

**Success criteria**
- `sitemap.xml` includes:
  - existing static URLs (from Sprint 22 foundation)
  - instructor URLs generated from real endpoint (paginated exhaustively)
- `next build` passes in `apps/web`
- Any existing “sitemap foundation” tests/build scripts remain green (or are updated minimally, without changing backend contracts)

---

## 1) Context (from status.md)

- Public instructor profile skeleton exists: `apps/web/src/app/instructors/[slug]/page.tsx` (Sprint 20 M1)
- SEO meta foundation exists for instructor profile (Sprint 21 M1)
- Backend supports public instructor profile read:
  - `GET /public/instructors/:slug` (APPROVED-only gate)
- Sprint 23 added list endpoint:
  - `GET /public/instructors` (APPROVED-only, cursor pagination)

(See `status.md` for the above sprint history and constraints.)

---

## 2) Target Behavior

### 2.1 Sitemap output
- Keep all static routes already emitted in Sprint 22 (do not regress).
- Add instructor URLs:
  - URL pattern: `/instructors/{slug}`
  - `slug` comes from list endpoint.
  - Must include **all** instructors (iterate cursor pagination until completion).
- If the list endpoint fails (network/env missing), sitemap must still render using **static-only fallback**, and should not throw unhandled errors.

### 2.2 Runtime & rendering model
- Sitemap generation must be safe under:
  - **SSR** request-time generation (if using route handler)
  - **build-time** generation (if using `app/sitemap.ts`)
- Use `fetch` with explicit `cache` semantics suitable for sitemap:
  - Prefer `force-cache` with `revalidate` (e.g., daily) OR a conservative default consistent with current foundation.
  - Do **not** make the sitemap fully dynamic unless Sprint 22 already did.

---

## 3) API Contract (Do not change)

### 3.1 `GET /public/instructors`
- Returns **APPROVED-only** instructors.
- Supports cursor pagination.
- Response shape is whatever Sprint 23 implemented; frontend adapter must conform.

**Adapter rule:** Treat response as authoritative; do not infer approval on frontend.

### 3.2 Error handling expectations
- Backend uses structured envelope (Sprint 15). Public endpoints may still differ depending on implementation.
- Adapter must:
  - handle non-2xx
  - handle unexpected JSON shape
  - return `{ ok: false }` (or an equivalent sentinel) and let sitemap fall back without throwing

---

## 4) Implementation Plan (Frontend)

### 4.1 Replace `instructors.stub.ts` with real adapter
Create/modify a single adapter module that exports:

- `listInstructorsForSitemap(): Promise<{ slugs: string[]; source: 'remote' | 'stub' }>`

Requirements:
- Exhaust cursor pagination:
  - loop until `nextCursor` is null/undefined/empty
  - accumulate instructor slugs
  - de-duplicate slugs defensively
- Guardrails:
  - max pages safety cap (e.g., 1000) to prevent infinite loops if server misbehaves
  - per-request timeout (AbortController) (optional but recommended)
- Fallback:
  - if any fatal error occurs (fetch fails / invalid response), return stub slugs from the existing stub module OR empty list (but keep static sitemap entries)

**Important:** “Replace stub” means the sitemap path must use the adapter; the stub file can remain as fallback source but should not be the primary source.

### 4.2 Wire sitemap generation to adapter
Depending on Sprint 22 foundation, sitemap likely lives in one of these:
- `apps/web/src/app/sitemap.ts` (Next.js Metadata Route)
- `apps/web/src/app/sitemap.xml/route.ts` (custom route)

Update the sitemap generator to:
- keep existing static routes unchanged
- call `listInstructorsForSitemap()`
- append instructor URLs to the returned array
- avoid throwing on adapter failure; log minimally in dev only

### 4.3 Environment & base URL resolution
Use the existing public API fetch util if available (Sprint 20 created `apps/web/src/lib/api.ts`).

Rules:
- Prefer a single base URL env already used by web app.
- If base URL is missing:
  - adapter must fail soft and return stub/empty
- Do not introduce backend coupling; keep as pure HTTP fetch to `/public/instructors`.

---

## 5) File Touch List (expected)

> Adjust paths to match the existing Sprint 22 sitemap foundation.

- `apps/web/src/lib/instructors.stub.ts` (keep as fallback source or minimal edits)
- `apps/web/src/lib/instructors.adapter.ts` (new/modified: real endpoint adapter)
- `apps/web/src/app/sitemap.ts` **or** `apps/web/src/app/sitemap.xml/route.ts` (wire adapter into sitemap)
- `apps/web/src/lib/api.ts` (only if necessary for shared fetch helper; prefer no changes)

---

## 6) Edge Cases & Fallback Rules

- **No instructors returned:** sitemap still valid; just static routes.
- **Invalid/empty slug:** filter out falsy/whitespace; do not emit malformed URLs.
- **Duplicate slug:** de-dup.
- **Non-2xx:** fallback.
- **Unexpected JSON shape:** fallback.
- **Rate limits / transient failure:** optional single retry; otherwise fallback.

---

## 7) Acceptance Tests (manual + build)

### 7.1 Local dev smoke
- Start server + web
- Visit `/sitemap.xml`:
  - contains existing static URLs
  - contains at least one `/instructors/...` URL when backend has APPROVED instructors
- Temporarily break base URL env (or stop server):
  - `/sitemap.xml` still loads and contains static-only URLs (no crash)

### 7.2 CI/build
- `cd apps/web && pnpm build` passes without requiring backend to be reachable.

---

## 8) Done Definition

- Instructor URLs are sourced from `GET /public/instructors` via adapter.
- Stub is only used as fallback (or removed if foundation already embeds static-only fallback elsewhere).
- No backend changes.
- SSR correctness + fallback behavior preserved.

---

## 9) Sprint Snapshot (for status.md update later)
- Sprint 24: SEO / sitemap integration (frontend-only)
- Commit message convention (suggested):
  - `feat(s24): wire sitemap to public instructors list adapter`
