import { normalizeTitleString } from "./normalize"

export type MatchConfidence = "high" | "medium" | "unmatched"

export interface RoleCandidate {
  // The role's Convex id, passed through opaquely as a string so packages/core
  // stays free of Convex Id types. Callers narrow it back to Id<"roles">.
  roleId: string
  title: string
  trackKey: "IC" | "Lead" | "M"
}

export interface TitleInput {
  importedTitle: string
  personCount: number
  // Whether any person sharing this title is flagged isManager. Used only as a
  // fuzzy-match tiebreaker (manager nudge), never as a primary signal.
  hasManager?: boolean
  // Reserved future secondary signal. Accepted for forward compatibility and
  // currently ignored by the algorithm (YAGNI).
  statisticalCode?: string
}

export interface TitleSuggestion {
  importedTitle: string
  personCount: number
  suggestedRoleId: string | null
  confidence: MatchConfidence
}

const DEFAULT_THRESHOLD = 0.5

// Token set of a normalized string. Empty tokens are dropped.
function tokenSet(normalized: string): Set<string> {
  return new Set(normalized.split(" ").filter((t) => t.length > 0))
}

// Jaccard index of two token sets: |intersection| / |union|. 0 when both empty.
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection += 1
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

// Track ranking for the manager nudge: Lead/M outrank IC. Higher wins.
function managerRank(trackKey: RoleCandidate["trackKey"]): number {
  return trackKey === "IC" ? 0 : 1
}

interface PreparedRole {
  role: RoleCandidate
  normalized: string
  tokens: Set<string>
}

export function suggestRoleForTitles(
  titles: readonly TitleInput[],
  roles: readonly RoleCandidate[],
  options?: { threshold?: number }
): TitleSuggestion[] {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD

  const prepared: PreparedRole[] = roles.map((role) => {
    const normalized = normalizeTitleString(role.title)
    return { role, normalized, tokens: tokenSet(normalized) }
  })

  return titles.map((input) => {
    const normalizedTitle = normalizeTitleString(input.importedTitle)
    const titleTokens = tokenSet(normalizedTitle)
    const base = {
      importedTitle: input.importedTitle,
      personCount: input.personCount,
    }

    // Tier 1: exact normalized match. Collect all exact matches so a tie can be
    // broken by the manager nudge, then by lexical title order.
    const exact = prepared.filter((p) => p.normalized === normalizedTitle)
    if (exact.length > 0) {
      const winner = pickWinner(exact, input.hasManager === true)
      return {
        ...base,
        suggestedRoleId: winner.role.roleId,
        confidence: "high",
      }
    }

    // Tier 2: fuzzy match. Compute Jaccard for every role, keep those strictly
    // above the threshold, then pick the best (highest score; ties broken by
    // manager nudge, then lexical title).
    let bestScore = threshold
    const bestCandidates: PreparedRole[] = []
    for (const p of prepared) {
      const score = jaccard(titleTokens, p.tokens)
      if (score > bestScore) {
        bestScore = score
        bestCandidates.length = 0
        bestCandidates.push(p)
      } else if (score === bestScore && score > threshold) {
        bestCandidates.push(p)
      }
    }
    if (bestCandidates.length > 0) {
      const winner = pickWinner(bestCandidates, input.hasManager === true)
      return {
        ...base,
        suggestedRoleId: winner.role.roleId,
        confidence: "medium",
      }
    }

    // Tier 3: no match.
    return { ...base, suggestedRoleId: null, confidence: "unmatched" }
  })
}

// Deterministic tiebreak: with hasManager, prefer higher managerRank; then
// break by lexically earliest role title.
function pickWinner(
  candidates: readonly PreparedRole[],
  hasManager: boolean
): PreparedRole {
  const sorted = [...candidates].sort((a, b) => {
    if (hasManager) {
      const rankDiff =
        managerRank(b.role.trackKey) - managerRank(a.role.trackKey)
      if (rankDiff !== 0) return rankDiff
    }
    return a.role.title.localeCompare(b.role.title, "en")
  })
  // sorted[0] is always defined here: pickWinner is only called with a non-empty
  // candidates array.
  return sorted[0] as PreparedRole
}
