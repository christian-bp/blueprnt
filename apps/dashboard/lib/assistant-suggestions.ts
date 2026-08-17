// The starter chips under the assistant's input, as POOLS rather than fixed
// lists. Every key resolves under `dashboard.assistant`.
//
// A pool is a list of GROUPS, and exactly one key is drawn from each group, so
// the row always covers the same ground while the questions themselves change
// between visits. The groups are the capability families of the assistant's
// tool set (backend assistant/tools.ts): the organization's current numbers
// (get_org_stats, get_pay_stats), how those numbers have MOVED (the two trend
// charts), and how the product and the domain work (search_docs). Drawing per
// group rather than shuffling one flat list is the whole point: a flat shuffle
// eventually shows three variations of the same question and hides two thirds
// of what the assistant can do.
//
// The trend group holds only two, deliberately. There are exactly two trend
// tools, and a third question there could only be a rephrasing of one of them.

// Every chip's key must exist under `dashboard.assistant`, so a typo is a
// compile error at the pool rather than a raw key rendered into a button.
export type SuggestionKey =
  | "suggestionPayByGender"
  | "suggestionOrgState"
  | "suggestionMedianPay"
  | "suggestionGapTrend"
  | "suggestionHeadcountTrend"
  | "suggestionPayMapping"
  | "suggestionImportPeople"
  | "suggestionEvaluateRole"
  | "suggestionCriterion"
  | "suggestionLevelSeniority"
  | "suggestionEqualWork"

export type SuggestionPool = readonly (readonly SuggestionKey[])[]

// In the app the reader is looking at their own organization, so the row leads
// with its numbers. It never leads with a trend: a trend plots one point per
// COMPLETED pay mapping, so it is empty until an org has finished one, and a
// first chip that answers "no data yet" teaches the reader that the assistant
// has nothing. The current-numbers group reads the live register instead and
// works from the first import.
export const ASSISTANT_SUGGESTION_POOL: SuggestionPool = [
  ["suggestionPayByGender", "suggestionOrgState", "suggestionMedianPay"],
  ["suggestionGapTrend", "suggestionHeadcountTrend"],
  ["suggestionPayMapping", "suggestionImportPeople", "suggestionEvaluateRole"],
]

// In the guide the reader came to understand something rather than to look up
// their own figures, so all three groups are questions the corpus answers: a
// concept, the statute, and a how-to. Level vs seniority earns its place
// because it is the domain's single most confused boundary.
export const DOCS_SUGGESTION_POOL: SuggestionPool = [
  ["suggestionCriterion", "suggestionLevelSeniority"],
  ["suggestionEqualWork", "suggestionPayMapping"],
  ["suggestionEvaluateRole", "suggestionImportPeople"],
]

// One key per group. `random` is injected so the draw is testable; call sites
// leave it at Math.random.
//
// Callers must draw ONCE PER MOUNT (a useState initializer), never during
// render: a fresh draw on every render would change the chips under the
// reader's cursor. This is safe to run in a render-phase initializer only
// because the authenticated shell never server-renders (the server paint is
// the loading screen), so there is no server draw for a client draw to
// disagree with. A surface that starts server-rendering has to move the draw
// into an effect and accept the swap that comes with it.
export function sampleSuggestions(
  pool: SuggestionPool,
  random: () => number = Math.random
): SuggestionKey[] {
  return pool.flatMap((group) => {
    const pick = group[Math.floor(random() * group.length)] ?? group[0]
    return pick === undefined ? [] : [pick]
  })
}
