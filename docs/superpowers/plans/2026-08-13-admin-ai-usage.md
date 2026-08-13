# Admin: AI usage overview

> Owner direction: an admin page showing every organization's AI usage, with a big chart to spot orgs using "too much", plus anything else platform admins need about AI usage.

## Data reality

- `aiUsageMonthly` (one row per org per month): `callCount`, `inputTokens`, `outputTokens`, `totalTokens`, `costNanos`, `byKind` (record kind -> callCount). Index today: `by_org_period` only.
- `aiUsageEvents` (row per call): model, provider, tokens, `estimatedCostNanos`, kind. Indexes `by_org`, `by_org_kind`.
- Security boundary: `platformQuery` (`requirePlatformAdmin`, lib/functions.ts), the same gate the email log uses.
- Cost semantics: `costNanos` derives from `ai/pricing.ts`; the implementer verifies the currency unit (USD) before formatting.

## Design

Route `/admin/ai-usage`, added to the admin section's nav beside audit-log/email-log/organizations.

1. **KPI tiles** (top row): total cost this period, total calls, total tokens, month-over-month cost change, active orgs (orgs with any usage). WidgetCard-style tiles like the overview's.
2. **The big chart**: horizontal ranked bars, one per org, sorted by cost desc for the selected period, full-width PanelCard. House chart anatomy (`chart-style.ts` constants, BAR_RADIUS, CHART_TOOLTIP_TEXT; hover shows cost, calls, tokens, kind split). Ink: `--chart-1`; **outlier bars** in `--flag-elevated` amber. Outlier definition, honest and simple: cost > max(3x median across orgs with usage, an absolute floor constant), stated in a caption under the chart so the flag is never a mystery.
3. **Per-org table** below: org name, cost, calls, tokens, share of total, MoM change, kind split (assistant.chat / assistant.title / prefill / ... as compact labeled chips), flagged state. House register-table anatomy: TanStack, toolbar search, sortable headings (default cost desc), table-fixed, pagination past 25, content-shaped skeleton sharing PAGE_SIZE.
4. **Period selector**: a `Select` over the last 6 months (client-generated period keys), defaulting to the current month.

## Backend (new `convex/platform/aiUsage.ts`, all platformQuery)

- Schema: add `.index("by_period", ["period"])` to `aiUsageMonthly` (platform-wide reads must not scan). Rows per period = number of orgs: bounded.
- `usageByOrg({ period })`: monthly rows for the period + the PREVIOUS period (for deltas), joined with org names (same org-name source the organizations admin page uses). Returns per-org: orgId, name, costNanos, callCount, totalTokens, byKind, prevCostNanos. Client derives totals, shares, median, outliers (pure lib helpers with tests).
- No PII anywhere (org-level aggregates only). No audit rows (reads).

## Tasks

1. Backend: index + platform query + convex-test coverage (gate rejected for non-admins, period join, previous-period delta, org-name join).
2. Frontend: page, nav entry, KPI tiles, ranked bar chart with outlier flagging, table, period selector, i18n in all five locales, skeletons, tests (outlier math as pure lib unit tests; component tests for states).
3. Review + live browser pass (seed data exists across two orgs from today's testing).
