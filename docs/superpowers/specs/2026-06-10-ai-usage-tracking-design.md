# AI usage tracking: design

**Date:** 2026-06-10. **Related ADRs:** ADR-0001 (EU data residency), ADR-0003 (AI is a suggestion layer with provenance). This is a pure observability slice: it adds no AI behavior and does not touch the deterministic score/band path. It records what the existing AI calls already consume.

## What changes

Every AI generation in `convex/ai/generate.ts` (`generateModelDraft`, `generateRoleProfileDraft`, `reviewWeights`) calls the Vercel AI SDK's `generateText`, which returns `result.totalUsage` (input, output, total tokens, with cached-input detail). Today that usage is discarded. We capture it: one immutable usage event per call plus a per-org-per-month rollup, so we can see where token cost concentrates as we scale, and so a future per-org quota becomes a single-row read. V1 is observe-only and internal-only: no enforcement, no customer-facing UI, no new public function.

## Decisions

1. **Events plus a denormalized monthly rollup** (not events-only, not the `@convex-dev/aggregate` component). AI calls are user-triggered and low-frequency, so a rollup row patched in the same transaction as the event insert gives cheap totals with no meaningful write contention. The aggregate component is built for high-throughput ordered sums and is overkill here; revisit only if AI volume ever becomes high-frequency.
2. **Derive context from the suggestion, do not thread it through the action.** A suggestion already carries `orgId`, `target.kind`, and `model: { provider, model }`. The recording mutation takes only token counts and the `suggestionId` and reads the rest off the suggestion. No prompt-layer args change.
3. **Cost is stored, in integer nano-USD, snapshotted at write time.** Raw tokens are the source of truth and are always stored. Cost is computed from a `MODEL_PRICING` constant (`model -> { inNanosPerToken, outNanosPerToken }`) at write time and frozen into the event, because Mistral pricing moves over time. Deriving historical cost later from one current price would misattribute it. Nano-USD (1e-9 USD) keeps cost an exact integer even at sub-dollar-per-million prices: the verified current price for `mistral-large-latest` (Mistral Large 3, per mistral.ai/pricing 2026-06-10) is $0.50 per 1M input tokens and $1.50 per 1M output tokens, i.e. exactly 500 and 1500 nano-USD per token. (Micro-USD would force fractions: $0.50/1M = 0.5 micro-USD/token.) If a model is missing from the map, tokens are still recorded, cost is 0, and we log it.
4. **Actor attribution via a new `requestedBy` on the suggestion.** The three request mutations already hold `ctx.authUserId`; each sets `requestedBy` on the suggestion at insert. The recording mutation copies `suggestion.requestedBy` onto the event as `actorId`. This adds no action-arg threading and gives the suggestion a request-side provenance field that complements `confirmedBy` / `rejectedBy`.
5. **Successful calls only in V1.** The `generateText` error path exposes no usage, so failures keep their existing `console.error` plus `markFailed` and are not counted. A failure counter is deferred.
6. **Usage recording is best-effort and isolated.** The action calls the recording mutation in its own try/catch so a usage-write failure can never flip a successful generation to `failed`.

## Data model (`convex/ai/tables.ts`, composed into `schema.ts`)

`aiUsageEvents` (append-only telemetry):
- `orgId: string`, `kind: string` (`"model.draft" | "model.weightReview" | "role.profile"`), `provider: string`, `model: string`
- `inputTokens`, `outputTokens`, `totalTokens`, `cachedInputTokens` (all `number`, coalesced from the SDK's `number | undefined` to 0 on write)
- `estimatedCostNanos: number` (integer nano-USD, snapshotted)
- `actorId: optional(string)` (the `requestedBy` from the suggestion)
- `suggestionId: optional(id("suggestions"))` (drill-down link)
- Indexes: `by_org`, `by_org_kind`. Time ranges use `_creationTime`.

`aiUsageMonthly` (rollup):
- `orgId: string`, `period: string` (`"YYYY-MM"`, UTC, from `Date.now()` in the mutation)
- `callCount`, `inputTokens`, `outputTokens`, `totalTokens`, `costNanos` (all `number`)
- `byKind: record(string, number)` (call count per feature kind)
- Index: `by_org_period`.

`suggestions` table gains `requestedBy: optional(string)`.

## Write path

New `internal.ai.usage.recordAiUsage({ suggestionId, inputTokens, outputTokens, totalTokens, cachedInputTokens? })` (`internalMutation`):
1. Load the suggestion. If absent, log and return (best-effort; never throw into the caller).
2. Derive `orgId`, `kind = target.kind`, `provider`/`model` from `suggestion.model`, `actorId = suggestion.requestedBy`.
3. Compute `estimatedCostNanos` from `MODEL_PRICING[model]` (0 + log if unknown).
4. Insert the `aiUsageEvents` row.
5. Upsert `aiUsageMonthly` for `(orgId, period)`: patch-increment if the row exists, else insert. Same transaction as step 4.

Each of the three actions, on the success path after `generateText` returns, calls `recordAiUsage` with `result.totalUsage` fields, wrapped in an isolated try/catch (logs, never rethrows).

## Read path (V1, internal only)

Two `internalQuery`s for ops use from the Convex dashboard:
- `getOrgUsage(orgId, period?)`: that org's monthly rollup(s), optionally one period.
- `getTopOrgsByCost(period?)`: all `aiUsageMonthly` rows, sorted by `costNanos` descending, to answer "where is the spend."

No public (client-callable) function, so no new auth surface and no dashboard UI in V1.

## Future quota hook (designed for, not built)

An org's running monthly total is a single `aiUsageMonthly` row. Enforcement later becomes: read that row in the request mutation, throw `errors.aiQuotaExceeded` (new code) when over a configured per-org cap. No schema change required to add it.

## Audit invariant note (needs ratification)

CLAUDE.md lists "every state-changing mutation writes an audit row" as an architecture invariant. `recordAiUsage` deliberately does not write an `AUDIT_EVENTS` row: it is system telemetry, not a user-initiated change to auditable domain state, and `aiUsageEvents` is itself an append-only log. Proposed reading: the audit invariant governs user-initiated domain mutations, and an append-only telemetry log is outside its scope. This carve-out should be ratified by a one-line amendment to the invariant's wording (or a short ADR) so the exception is documented rather than implicit.

## Out of scope (V1)

- Quota enforcement, soft or hard caps, per-org limit config.
- Any customer-facing or org-admin usage UI.
- Counting failed or partial generations.
- Cost reconciliation against Mistral's actual invoices (our figure is an estimate from a pricing snapshot).
- Backfill of usage for generations made before this ships (no historical SDK usage was retained).

## Consequences for tests

Backend unit tests (convex-test, edge runtime), mirroring the existing `suggest.test.ts` pattern (call the recording mutation directly; the `"use node"` actions are not unit-tested here):
- `recordAiUsage` inserts an event and creates the monthly rollup with correct tokens, cost, `callCount`, and `byKind`.
- Cost is the exact nano-USD integer for a known model; an unknown model records tokens with cost 0 and does not throw.
- `undefined` token fields coalesce to 0.
- A second call for the same `(orgId, period)` increments the existing rollup row rather than inserting a new one; a different period creates a new row.
- `actorId` is carried from the suggestion's `requestedBy`.

Verifying that a thrown `recordAiUsage` does not fail a successful generation is action-level wiring and is e2e scope (Playwright, later), per the backend testing policy.
