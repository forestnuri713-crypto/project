# Sprint 22 SSOT — SEO Expansion: Dynamic Sitemap Foundation (apps/web only)

> Source of truth: this document.  
> Context reference: project status.md (latest 2026-02-16). fileciteturn0file0  
> Sprint theme: **SEO Expansion** (Next.js App Router)

---

## 0) Goal / Non-Goals

### Goal
- **Dynamic sitemap foundation** for the public site (apps/web).
- Output must include **only**:
  - **Public** pages
  - **APPROVED + public instructors** (i.e., pages that are actually accessible without auth)
- Must preserve:
  - **SSR correctness**
  - **Existing Playwright E2E** stability (no breaking changes)

### Non-Goals (explicit)
- No backend modifications (server/db/contracts unchanged).
- No large refactors of routing, auth, or existing instructor profile page.
- No “full SEO suite” beyond sitemap foundation (robots, RSS, rich schema) unless trivial.

---

## 1) Current Baseline (from status.md)

- apps/web exists and serves public instructor profile at `/instructors/[slug]`.
- Backend already enforces **APPROVED-only** visibility for public instructor profiles (public endpoint returns 404 otherwise).
- Sprint 21 implemented dynamic metadata on `/instructors/[slug]`.
- Repo guardrails include required web E2E checks (Playwright). fileciteturn0file0

Assumption A (must validate in M0):
- There is **some** way to enumerate public instructors (e.g., `GET /public/instructors` list endpoint), or an alternative source for slugs.
- If enumeration does **not** exist, Sprint 22 still ships a **foundation** that is correct for static routes and supports future plugging-in of an instructor slug source without redesign.

---

## 2) Architectural Decision

### Decision
Implement sitemap using **Next.js App Router metadata routes**:
- `apps/web/src/app/sitemap.ts` (or `/sitemap.xml` metadata route equivalent)
- Optional: `apps/web/src/app/sitemap-instructors.ts` + `src/lib/sitemap/*` as internal abstraction

### Rationale
- First-class Next.js SEO primitive; SSR-safe and build/runtime aligned.
- Enables clean separation:
  - “URL generation” (pure)
  - “Data sourcing” (API or fallback)
- Minimal risk to existing pages and E2E.

### Sitemap Strategy
- Always include **static** public URLs (home, instructors index if exists, etc.).
- Include **dynamic instructor URLs** only when we can **guarantee** they are public:
  - Prefer **list endpoint that already filters to APPROVED**,
  - Else if only “fetch-by-slug” exists, do **not** guess slugs (avoid 404 spam / index noise).
  - Provide a controlled “source adapter” for later integration.

---

## 3) Implementation Plan (Milestones)

> Rule: No large code blocks in planning. Each milestone has acceptance criteria.

### M0 — Contract Validation (blocking)
**Objective:** Confirm how to enumerate public instructors without backend changes.

Tasks:
- Inspect `apps/web/src/lib/api.ts` and any public API clients.
- Confirm one of the following:
  1) `GET /public/instructors` (or equivalent) exists with pagination
  2) Another existing public discovery endpoint returns instructor slugs
  3) No enumeration exists

Acceptance criteria:
- Written note in this SSOT “Contract Validation” section:
  - Endpoint path(s), request params, response shape (fields needed: `slug`, `updatedAt` or `createdAt`).
  - If none exist: explicitly state “No enumeration endpoint found”.

---

### M1 — Sitemap Core (static routes)
**Objective:** Ship a working sitemap that includes stable, public, static pages.

Tasks:
- Add `app/sitemap.ts` returning `MetadataRoute.Sitemap`.
- Include:
  - `/` (home)
  - Any other always-public routes that exist in apps/web (verify by filesystem routing)
- Use `NEXT_PUBLIC_SITE_URL` if present; otherwise return relative URLs (Next will handle).

Acceptance criteria:
- `next build` passes.
- Hitting `/sitemap.xml` (or Next’s sitemap endpoint) returns valid XML.
- No changes required to backend or shared packages.

---

### M2 — Instructor URLs (dynamic) with “Approved-only” correctness
**Objective:** Include `/instructors/{slug}` URLs only when sourced from a contract that guarantees public/approved.

Branching:
- **If M0 confirms enumeration endpoint**:
  - Fetch slugs server-side inside sitemap route.
  - Ensure response is filtered to APPROVED/public by contract (or filter client-side using a status flag if provided).
  - Set `lastModified` from `updatedAt` when available.
- **If M0 finds no enumeration endpoint**:
  - Do not include instructor URLs yet.
  - Implement **SitemapSourceAdapter** interface with a stub provider returning `[]`.
  - Add a TODO marker that unblocks future sprint once a list endpoint exists.

Acceptance criteria:
- Sitemap contains instructor URLs only in the “enumeration exists” case.
- No private/unapproved URLs emitted.
- Fail-safe: if API errors, sitemap still returns static routes (graceful degradation).

---

### M3 — Caching & Performance Guardrails (SSR safe)
**Objective:** Avoid accidental slow/unstable sitemap generation.

Tasks:
- Use Next.js `fetch` caching semantics intentionally:
  - Prefer `revalidate` (e.g., 1–6 hours) for list fetch.
- Add timeouts or error handling so sitemap does not hang.
- Ensure no per-request heavy computation.

Acceptance criteria:
- Deterministic behavior under API failure (static-only fallback).
- No console error spam during `next build` or `next start`.

---

### M4 — E2E / Regression Validation
**Objective:** Ensure Playwright E2E is not broken and sitemap is stable.

Tasks:
- Run existing Playwright suite (no modifications expected).
- Optionally add a minimal test that:
  - Requests `/sitemap.xml`
  - Asserts status 200 and contains `<urlset` (or Next’s sitemap format)

Acceptance criteria:
- Existing Playwright E2E passes unchanged.
- If a new test is added, it is resilient (no brittle exact URL count assertions).

---

## 4) Risk Assessment

### R1 — No instructor enumeration endpoint exists (high likelihood)
- Impact: Cannot generate complete instructor sitemap without guessing.
- Mitigation: Ship foundation + adapter; keep sitemap correct (static only) rather than incorrect.

### R2 — Emitting non-public URLs (high severity)
- Impact: SEO noise, 404 indexing, possible policy breach (private leakage).
- Mitigation: Only emit instructor URLs from an approved/public source contract; never infer.

### R3 — Sitemap generation breaks SSR or E2E (medium)
- Impact: CI fails; deployment blocked.
- Mitigation: Isolate changes to `app/sitemap.ts` + small lib; avoid touching existing pages.

### R4 — Runtime performance / API flakiness (medium)
- Impact: Slow crawl responses; potential 5xx.
- Mitigation: `revalidate`, fast fallback, strict error handling.

---

## 5) Contract Validation (fill during M0)

### Required fields to emit instructor URLs
- `slug: string` (canonical slug)
- `updatedAt | createdAt` (optional but preferred for lastModified)
- A guarantee that returned instructors are **APPROVED/public**, OR enough fields to filter safely

### Findings (M0 completed — 2026-02-18)
- [x] **No enumeration endpoint found.** Static-only + adapter stub shipping.
- Only `GET /public/instructors/:slug` exists (`public.controller.ts:11`, `public.service.ts:47`).
  - Single-fetch by slug; returns APPROVED-only profile or 404.
  - 308 slug-history redirect implemented in `public.service.ts:62-68` and `public.controller.ts:19-21`.
  - Response shape: `{ success, data: { id, slug, isPublic, displayName, profileImageUrl, coverImageUrl, bio, certifications[], provider } }`.
  - No `updatedAt`/`createdAt` field in response.
- **M2 decision:** `SitemapSourceAdapter` stub returns `[]`. Instructor URLs are NOT emitted in Sprint 22. Rationale: no safe enumeration contract exists.

---

## 6) Definition of Done

- apps/web ships a sitemap endpoint without backend changes.
- Sitemap is **correct-by-construction** (never emits unapproved instructor URLs).
- Existing Playwright E2E passes.
- SSR correctness maintained (no client-only hacks).

---

## 7) Change Log
- 2026-02-18: Initial SSOT created for Sprint 22 (SEO Expansion: Dynamic Sitemap Foundation).
