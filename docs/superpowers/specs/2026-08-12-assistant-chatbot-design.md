# In-App Assistant (Chatbot) Design and Architecture Decision

**Date:** 2026-08-12 (revised same day: page surface instead of sheet, overview prompt, in-chat charts)
**Status:** Proposed (requires sign-off on the ADR question below before implementation)
**Plan:** `docs/superpowers/plans/2026-08-12-assistant-chatbot.md`

## What was asked

1. Add a chatbot, using the shadcn chatbot template's UI approach (cloned at
   `/Volumes/development/blueprnt/chatbot-template`).
2. Decide: Convex backend with only the template's UI, or the template's AI SDK route-handler
   architecture. AI stays on Mistral (EU).
3. Revision 1: not a side sheet. A page, like midday
   (`/Volumes/development/personal/midday`), with an AI textarea on the overview page,
   without removing the overview's existing content.
4. Revision 2: every AI call must land in the existing usage record (`aiUsageEvents`).
5. Revision 3: the assistant should render charts in its answers, like midday.

## Governance first: this feature contradicts a standing ADR

`docs/adr/0003-ai-embedded-assistant.md` states verbatim: *"AI används som inbäddad assistans i
flödet (inte en chatbot)"*, and `docs/PLAN-V1.md` (E8) repeats *"Inbäddat i flödet, aldrig
chatbot"*. Per CLAUDE.md, architecture invariants are never broken without a new ADR.

**Consequence:** Phase 0 of the plan writes ADR-0018 (Swedish, status Föreslagen) superseding
the "never a chatbot" clause while carrying forward everything else ADR-0003 protects:

- AI never touches the deterministic score/level path (`packages/core` untouched).
- AI calls happen only in Convex actions, only against EU-hosted models (Mistral direct, AI
  Gateway forbidden, ADR-0001).
- Never send personal data to the AI (Role is not Person; GDPR). The assistant's data access
  is a fixed set of read-only tools returning org-level numeric aggregates. Individual rows
  never leave the deterministic query layer; only group-floored statistics reach the model
  (see "Pay statistics questions" below).
- The assistant changes no domain state. If it ever gains write-capable tools, each write goes
  through the existing suggestion/confirm flow with provenance (ADR-0003 unchanged there).

## Decision 1: backend

### Options considered

**A. `@convex-dev/agent` component.** Off-the-shelf threads, streaming, hooks, usage handler.
**Blocker:** version 0.6.4 pins `ai@^6.0.35` (peerDependency, confirmed on npm and in the
repo's own contributor docs: "v0.6.0 requires AI SDK v6"). Our backend is on `ai@^7.0.51`
(with `@ai-sdk/mistral@^4`), and ADR-0003's addendum standardized the v7 API across
`convex/ai/`. Adopting it means downgrading the whole AI module or carrying two incompatible
`ai` majors in one bundle. Mistral is also undocumented for the component. **Rejected for
now; revisit if/when it supports AI SDK v7** (migration stays contained because the component
keeps its own tables).

**B. AI SDK route handler in Next.js (the template's architecture).** Violates the invariant
that AI calls happen only in Convex actions, splits the Mistral key into Vercel env, and the
template route is stateless and unauthenticated, so persistence, auth, and org scoping would
be rebuilt against Convex anyway. Notably, midday has the same shape (a Hono API route, no
message persistence at all: refresh loses the conversation). **Rejected.**

**C. Convex-native, hand-rolled on our existing patterns (chosen).** Two new tables
(`assistantThreads`, `assistantMessages`) in a new `convex/assistant/` bounded context.
`sendMessage` (orgMutation) inserts the user message plus a streaming placeholder and
schedules a `"use node"` internal action running AI SDK v7 `streamText` with
`@ai-sdk/mistral` and a small set of read-only tools. The action folds the stream into a
typed `parts` array on the placeholder row, flushing every ~250 ms; clients get streaming UX
purely through Convex reactivity (`useQuery`). Usage telemetry rides `recordAiUsageDirect`
(`kind: "assistant.chat"`), errors ride `appError`/`ERROR_CODES`, locale rides
`promptLocale`.

### Why C wins

Zero dependency conflicts, every invariant holds structurally (org scoping, EU residency,
erasure hooks in our own schema, compile-guarded no-PII tool outputs), and the plumbing is
small: 2 tables, ~10 functions, 1 action. Unlike both the template and midday, conversations
are durable and shared across tabs for free.

## Decision 2: surface (revised)

**An `/assistant` page plus an AI prompt block on the overview page.**

What midday actually does (verified in the repo): there is no separate chat route. The
overview page itself swaps between a landing state (greeting, one-line insight ticker, the
`AskMidday` input front and center, quick-action chips, widgets below) and the full chat
view, toggled by an `?assistant=true` query param, with one `ChatProvider` wrapping both
branches so the in-memory `useChat` state survives the swap. They need that trick because
their messages exist only in client memory.

We do not need the trick: our messages live in Convex. So we take the visible behavior
(type a question on the overview, land in a full-page conversation) with a simpler
mechanism:

- **Overview:** a new `AssistantPrompt` block (textarea + localized suggestion chips) inserted
  after the greeting/subtitle block and before the To-do row. Everything already on the page
  (todo cards, stat tiles, trend charts) stays, pushed below. Submit calls the same
  `sendMessage` mutation and then navigates to `/assistant`; the reply is already streaming
  into Convex when the page mounts.
- **`/assistant` page:** a first-class route (sidebar nav entry under Status), conversation
  capped at a centered readable column, composer pinned at the bottom, "New conversation" as
  the page action. Reachable any time to continue the active conversation.

## Decision 3: charts in answers (revised)

**Finding that shapes the design:** midday's current assistant does **not** render charts in
chat (verified by repo-wide grep: no chart library and no chart component anywhere in the
chat code path). Its report tools return JSON that the model paraphrases into markdown prose
and tables. The one rich widget, the invoice canvas, works by **reference + refetch**: the
UI extracts an invoice id from the tool result and refetches via tRPC, never rendering the
tool payload directly.

We adopt that reference pattern for charts, which fits our stack better than snapshotting:

- **Messages are typed parts, not plain text:** `{ type: "text", text }` or
  `{ type: "chart", chart: <kind>, summary }`. The union is a Convex validator, so an
  unknown part kind cannot be stored.
- **A chart tool does two things.** Its `execute` runs an org-scoped internal query returning
  compact numeric aggregates (the summary the MODEL sees, so cited numbers are real), and the
  generation action appends a `chart` part recording only the chart kind.
- **The client renders the chart from live org data**, reusing the exact components and hooks
  the overview already uses (`HeadcountTrend`, `PayGapTrend`, the `listPayMappingRuns`-derived
  builders). House chart anatomy (`chart-style.ts`) and the gender-encoding rules are
  inherited for free, and no data series is ever duplicated into chat storage. A chart in an
  old conversation shows current data, which is the honest behavior for a live register.
- **V1 tools (all read-only, aggregates only):** `get_org_stats` (workforce count, roles,
  evaluation progress, current pay gap, levels), `get_pay_stats` (average and median pay,
  org-wide and split by gender, group-floored; see below), `show_headcount_trend`,
  `show_pay_gap_trend`. Tool availability and queries are org-scoped server-side; the tool
  return validators contain only numbers and fixed enums, so a person field is a compile
  error. More chart kinds and groupings (gender distribution, level distribution, per-family
  breakdowns) come later once the pattern has proven itself.

### Pay statistics questions ("what is the average pay for our female employees?")

Yes, in scope, and the reasoning matters because it touches the hardest invariant:

- **The boundary is the AI-processor boundary, not the user boundary.** The user is HR and
  already sees individual pay throughout the product by design (HR-only audience). What
  ADR-0003 forbids is individual-level person data leaving for the model. An org-level
  statistic (mean pay of women across the org) is not an individual's salary; it is exactly
  the class of aggregate the pay-mapping analysis itself computes and displays.
- **Computation is deterministic and server-side.** `get_pay_stats` executes an org-scoped
  internal Convex query that derives the statistics from live register data using the same
  derivation helpers the pay-mapping analysis uses (`packages/core` pay-analysis +
  the `payMapping` context's current-pay derivation). The model receives only the finished
  aggregates: count, average, median per group, plus a composed summary sentence.
- **Small-group suppression is the guardrail.** An aggregate over a tiny group degenerates
  into an individual's salary ("average pay of women in the Data team" with one woman). Any
  group with fewer than `ASSISTANT_MIN_GROUP_SIZE` (3) members is suppressed: the tool
  returns a suppression marker instead of numbers, and the system prompt instructs the model
  to say the group is too small rather than guess. V1 limits grouping to fixed dimensions
  (org-wide, by gender), which also rules out arbitrary-filter differencing attacks.

### The full guardrail stack (strict, layered, each independently tested)

1. **Input screen:** before any model call, the incoming message is checked against the
   org's employees; a message containing an employee's full display name is refused with an
   explanation and never becomes a prompt (no AI call, no usage row).
2. **Prompt rules:** the system prompt forbids asking for, repeating, or processing personal
   data, and treats user text strictly as data (prompt-injection defense).
3. **Tool outputs:** return validators are numbers, fixed enums, and summaries composed from
   those numbers; a person field is a compile error.
4. **Statistical floor:** groups under 3 people are suppressed before leaving the query.
5. **Source confinement:** a guard test fails CI if any assistant module other than
   `insights.ts` reads the `people`/`payRecords`/`personAssignments` tables.
6. **Storage side:** chat content is erasable user data (hard delete on user erasure), and
   nothing chart-shaped is snapshotted into messages.

## Product shape (V1)

- Guidance plus org-level insight: explains concepts (from a curated system prompt distilled
  from the glossaries), points to the right page, answers data questions through the four
  tools (including pay statistics by gender), and shows the two trend charts inline.
- Responses in the user's current display language via `promptLocale`.
- Model: `mistral-medium-latest` default, env-overridable (`MISTRAL_ASSISTANT_MODEL`), priced
  in `ai/pricing.ts`.
- Guardrails: one in-flight generation per thread; 30 user messages per user per hour;
  4000-char input cap (clamped); tool loop capped at 3 steps; 120 s timeout; stop button
  (cooperative abort at each flush).
- **Usage record:** every generation that consumed tokens writes an `aiUsageEvents` row
  (`kind: "assistant.chat"`) via the existing `recordAiUsageDirect`, including stopped
  generations (totals raced against a short timeout after abort; skipped only if the
  provider reported nothing, with an ops log line). Same monthly rollup as every other AI
  feature.
- **Telemetry, not audit:** chat messages are conversational telemetry, not user-initiated
  changes to auditable domain state; no `logAudit` rows (stance recorded in ADR-0018).

## GDPR / erasure

Chat content is user-typed and may incidentally contain personal data despite guidance, so it
is treated as erasable user data from day one: threads and messages carry `userId`, and user
erasure (`eraseUser`/`eraseSelf`/platform `deleteUser`) schedules a chunked hard delete of
all of it. The UI empty state and the system prompt both instruct against sharing personal
data. Go-live checklist gains a retention-policy decision for archived threads and a
rate-limiter upgrade checkpoint.

## Out of scope (later, separate plans)

- More chart kinds and drill-down tools (gender distribution, level distribution, per-family
  aggregates).
- RAG over documentation; multi-thread history UI; attachments; write-capable tools (which
  would use the suggestion/confirm pattern); midday-style @mentions and quick-action chips
  beyond the three starters.

## Open decisions (recommendations marked)

1. **Approve ADR-0018** superseding the "aldrig chatbot" clause, now including the read-only
   aggregate tools. Everything is gated on this.
2. Default model: `mistral-medium-latest` (recommended) vs large (quality) vs small (speed).
3. Cap values: 30 messages/user/hour, 4000-char input, 3 tool steps (recommended starting
   points).
4. The pay-statistics suppression floor: minimum 3 people per reported group (recommended;
   raising it to 5 is a one-constant change).
