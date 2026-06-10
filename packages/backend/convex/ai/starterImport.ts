import {
  MAX_FAMILIES,
  MAX_FAMILY_NAME,
  MAX_ROLE_TITLE,
  MAX_ROLES,
  type StarterFamilyInput,
} from "../assessment/starters"
import { isTrackKey } from "../evaluationModel/localize"

const FALLBACK_TRACK_KEY = "IC"

// LLM output crosses a trust boundary: clamp the imported grouping to the
// starter-set contract (counts, lengths, fixed track keys, unique family
// names) so the stored suggestion is always confirmable as-is. Duplicate
// family names merge case-insensitively into the first occurrence because
// the insert path rejects duplicates outright; an unknown track key falls
// back to IC instead of failing the whole import.
export function sanitizeStarterImport(
  families: StarterFamilyInput[]
): StarterFamilyInput[] {
  const merged: StarterFamilyInput[] = []
  const byName = new Map<string, StarterFamilyInput>()
  let roleBudget = MAX_ROLES
  for (const family of families) {
    const name = family.name.trim().slice(0, MAX_FAMILY_NAME).trim()
    if (name === "") continue
    const lowered = name.toLowerCase()
    let target = byName.get(lowered)
    if (target === undefined) {
      if (merged.length >= MAX_FAMILIES) continue
      target = { name, roles: [] }
      byName.set(lowered, target)
      merged.push(target)
    }
    for (const role of family.roles) {
      if (roleBudget === 0) break
      const title = role.title.trim().slice(0, MAX_ROLE_TITLE).trim()
      if (title === "") continue
      target.roles.push({
        title,
        trackKey: isTrackKey(role.trackKey)
          ? role.trackKey
          : FALLBACK_TRACK_KEY,
      })
      roleBudget -= 1
    }
  }
  return merged.filter((family) => family.roles.length > 0)
}
