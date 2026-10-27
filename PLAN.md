# Plan: agent-collector v4 MVP

## Goal

Local privacy, shared wire contract and native observer adapters, implementing specification 0.1.

## Context

The operator authorized the attached six-step implementation plan on 2026-10-27. Cross-repository sequencing is in Operations specs/adrouter-v4-mvp-implementation-plan.md.

## Research Summary

Pinned OpenClaw v2026.10.7 and Hermes v0.22.5 tagged observation documentation inspected. Supabase Google PKCE and database isolation documentation govern identity and storage.

## Constraints

Preserve existing live products, APIs and data. Use Node 24.22.1, independent lockfiles and narrow dependencies. No real telemetry. Never represent synthetic tests as installed-host acceptance.

## Out of Scope

Payments, inference, AI enrichment, arbitrary buyer queries and historical imports.

## Reversibility

New repository and isolated resources; scoped commits and PRs. Admission stays off.

---

## Step A: Contracts and foundations

### Status

`in_progress`

### Tasks

- [ ] Establish pinned contracts, runtime, lockfile and CI.
- [ ] Validate shared synthetic fixtures.

### Acceptance Criteria

- [ ] Build and contract checks pass.

### Validation Results

- `npm run check`: passed locally for the current source. This is not full native/hosted acceptance.

---

## Step B: Implement required workflows

### Status

`in_progress`

### Tasks

- [ ] Implement repository-owned workflows and failure handling.
- [ ] Add meaningful access, privacy and lifecycle tests.

### Acceptance Criteria

- [ ] Applicable specification acceptance cases have evidence.

### Validation Results

- Runtime acceptance: not run

---

## Step C: Final verification and cleanup

### Status

`in_progress`

### Tasks

- [ ] Run relevant full suites and review final diffs.
- [ ] Remove debugging material; document operational and installation procedures.
- [ ] Record remaining platform, hosted and operator gates truthfully.

### Acceptance Criteria

- [ ] Exact source and package identities recorded with honest acceptance status.

### Validation Results

- Release qualification: not run

## Follow-up Work

See README and docs/remaining-work.md (or the README remaining-gates paragraph) for implementation gaps as well as native, browser, load, restore and hosted qualification. Pilot readiness remains unaccepted.

## Decision Log

| Date | Decision | Rationale | Impact |
| --- | --- | --- | --- |
| 2026-10-27 | Isolated v4 implementation | Explicit operator request | Existing products unchanged |
