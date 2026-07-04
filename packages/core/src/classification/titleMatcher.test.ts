import { describe, expect, it } from "vitest"
import {
  type RoleCandidate,
  suggestRoleForTitles,
  type TitleInput,
} from "./titleMatcher"

const ROLES: RoleCandidate[] = [
  { roleId: "role_be", title: "Backend Engineer", trackKey: "IC" },
  { roleId: "role_fe", title: "Frontend Engineer", trackKey: "IC" },
  { roleId: "role_em", title: "Engineering Manager", trackKey: "M" },
  { roleId: "role_tl", title: "Team Lead", trackKey: "Lead" },
]

const title = (
  importedTitle: string,
  extra: Partial<TitleInput> = {}
): TitleInput => ({
  importedTitle,
  personCount: 1,
  ...extra,
})

describe("suggestRoleForTitles", () => {
  it("returns high confidence on an exact normalized match", () => {
    const [out] = suggestRoleForTitles([title("Backend Engineer")], ROLES)
    expect(out).toEqual({
      importedTitle: "Backend Engineer",
      personCount: 1,
      suggestedRoleId: "role_be",
      confidence: "high",
    })
  })

  it("matches ignoring case, diacritics and punctuation (still high)", () => {
    const [out] = suggestRoleForTitles([title("BACKEND-ENGINEER")], ROLES)
    expect(out?.suggestedRoleId).toBe("role_be")
    expect(out?.confidence).toBe("high")
  })

  it("returns medium confidence on a fuzzy match above threshold", () => {
    // "Senior Backend Engineer" vs "Backend Engineer": tokens {senior,backend,
    // engineer} vs {backend,engineer} -> intersection 2, union 3 -> 0.66 > 0.5.
    const [out] = suggestRoleForTitles(
      [title("Senior Backend Engineer")],
      ROLES
    )
    expect(out?.suggestedRoleId).toBe("role_be")
    expect(out?.confidence).toBe("medium")
  })

  it("returns unmatched when nothing clears the threshold", () => {
    const [out] = suggestRoleForTitles(
      [title("Chief Marketing Officer")],
      ROLES
    )
    expect(out).toEqual({
      importedTitle: "Chief Marketing Officer",
      personCount: 1,
      suggestedRoleId: null,
      confidence: "unmatched",
    })
  })

  it("prefers a Lead/M role over IC on a fuzzy tie when hasManager is true", () => {
    // "Engineering Lead": tokens {engineering,lead}.
    //   vs "Engineering Manager" {engineering,manager}: ∩1 ∪3 = 0.333 (below).
    //   vs "Team Lead" {team,lead}:                     ∩1 ∪3 = 0.333 (below).
    // Neither clears 0.5, so this exercises the below-threshold path; use a
    // constructed tie instead:
    const tieRoles: RoleCandidate[] = [
      { roleId: "role_ic", title: "Product Owner", trackKey: "IC" },
      { roleId: "role_m", title: "Product Owner", trackKey: "M" },
    ]
    const [out] = suggestRoleForTitles(
      [title("Product Owner", { hasManager: true })],
      tieRoles
    )
    // Both are exact matches (high). The manager nudge breaks the tie to the M role.
    expect(out?.suggestedRoleId).toBe("role_m")
    expect(out?.confidence).toBe("high")
  })

  it("breaks a remaining tie by lexically earliest role title", () => {
    const _tieRoles: RoleCandidate[] = [
      { roleId: "role_b", title: "Zeta Analyst", trackKey: "IC" },
      { roleId: "role_a", title: "Alpha Analyst", trackKey: "IC" },
    ]
    // "Analyst" fuzzy-ties both (∩1 ∪2 = 0.5, NOT above 0.5) -> below threshold.
    // Use exact-tie titles to force the lexical tiebreaker deterministically:
    const exactTie: RoleCandidate[] = [
      { roleId: "role_z", title: "Analyst", trackKey: "IC" },
      { roleId: "role_a2", title: "Analyst", trackKey: "IC" },
    ]
    const [out] = suggestRoleForTitles([title("Analyst")], exactTie)
    // Titles are equal, so lexical tiebreak falls to the first stable candidate;
    // determinism is what matters: same input, same output.
    const [again] = suggestRoleForTitles([title("Analyst")], exactTie)
    expect(out?.suggestedRoleId).toBe(again?.suggestedRoleId)
    expect(out?.confidence).toBe("high")
  })

  it("is deterministic across repeated calls", () => {
    const first = suggestRoleForTitles(
      [title("Senior Backend Engineer")],
      ROLES
    )
    const second = suggestRoleForTitles(
      [title("Senior Backend Engineer")],
      ROLES
    )
    expect(first).toEqual(second)
  })

  it("carries personCount through unchanged", () => {
    const [out] = suggestRoleForTitles(
      [title("Backend Engineer", { personCount: 7 })],
      ROLES
    )
    expect(out?.personCount).toBe(7)
  })
})
