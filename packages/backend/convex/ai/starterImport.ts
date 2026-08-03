import {
  MAX_FAMILIES,
  MAX_FAMILY_NAME,
  MAX_ROLE_TITLE,
  MAX_ROLES,
} from "@workspace/constants"
import type { StarterFamilyInput } from "../assessment/starters"
import { isTrackKey } from "../evaluationModel/localize"

const FALLBACK_TRACK_KEY = "IC"

// What the sanitizer produced, plus whether the caps cost the user anything.
// `truncated` is reported rather than swallowed because the clamp is silent
// otherwise: a 150-role paste came back as 100 with the review showing only
// the survivors, and the done screen then reported the truncated number as
// the whole job.
export interface SanitizedStarterImport {
  families: StarterFamilyInput[]
  truncated: boolean
}

// LLM output crosses a trust boundary: clamp the imported grouping to the
// starter-set contract (counts, lengths, fixed track keys, unique family
// names) so the stored suggestion is always confirmable as-is. Duplicate
// family names merge case-insensitively into the first occurrence because
// the insert path rejects duplicates outright; an unknown track key falls
// back to IC instead of failing the whole import.
//
// `truncated` covers ONLY the cap-driven losses (a family past MAX_FAMILIES
// that held a real title, or a title the MAX_ROLES budget could not fit), not
// the trust-boundary drops (a blank name, a blank title): those remove nothing
// the user actually wrote, so reporting them would cry wolf on every import.
export function sanitizeStarterImport(
  families: StarterFamilyInput[]
): SanitizedStarterImport {
  const merged: StarterFamilyInput[] = []
  const byName = new Map<string, StarterFamilyInput>()
  let roleBudget = MAX_ROLES
  let truncated = false
  for (const family of families) {
    const name = family.name.trim().slice(0, MAX_FAMILY_NAME).trim()
    if (name === "") continue
    const lowered = name.toLowerCase()
    let target = byName.get(lowered)
    if (target === undefined) {
      if (merged.length >= MAX_FAMILIES) {
        if (family.roles.some((role) => role.title.trim() !== "")) {
          truncated = true
        }
        continue
      }
      target = { name, roles: [] }
      byName.set(lowered, target)
      merged.push(target)
    }
    for (const role of family.roles) {
      const title = role.title.trim().slice(0, MAX_ROLE_TITLE).trim()
      if (title === "") continue
      if (roleBudget === 0) {
        truncated = true
        continue
      }
      target.roles.push({
        title,
        trackKey: isTrackKey(role.trackKey)
          ? role.trackKey
          : FALLBACK_TRACK_KEY,
      })
      roleBudget -= 1
    }
  }
  return {
    families: merged.filter((family) => family.roles.length > 0),
    truncated,
  }
}
