import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { ExistingFamily, ExistingRole } from "@/lib/role-import"

// A role family as the AI proposes it, before it is placed in the draft.
export interface ProposedFamily {
  name: string
  roles: { title: string; trackKey: string }[]
}

// A draft seed row. Structurally the SeedFamily useDraftFamilies takes; kept
// declared here so this module stays a pure helper with no hook dependency.
export interface ImportSeedFamily {
  familyId?: Id<"roleFamilies">
  name: string
  roles: { title: string; trackKey: string }[]
}

export interface ImportSeed {
  families: ImportSeedFamily[]
  // Proposed roles dropped here because the family they target already holds
  // that title. They never reach the draft, so nothing downstream can count
  // them: the number has to travel with the seed or the import reports fewer
  // skips than it performed.
  skipped: number
}

const norm = (value: string) => value.trim().toLowerCase()

// Places the AI's proposal into the org's WHOLE register, producing the list
// the review is seeded from.
//
// Three things happen here, and all of them have to happen at seed time rather
// than per render.
//
// A proposed family that names one the org already has carries that family's
// real id, so the card is known to be register-backed by identity instead of by
// whatever is currently typed (a control that appeared and vanished as the name
// was edited would be unusable, and the name is static on such a family
// anyway). Every family the proposal did NOT target is added with no roles,
// because drag and drop operates on the draft: a family that is not in the list
// cannot be a drop target.
//
// And a proposed role whose title the target family ALREADY holds is dropped
// outright. The review used to render it as a faded row noted "already exists,
// will be skipped", directly under the identical row the family already had,
// which is a proposal to do nothing dressed up as a row to review. Dropping it
// at seed time (rather than hiding it later) is what makes it un-draggable and
// un-editable too: a row that cannot be created must not be movable into a
// family where it could be. A user who genuinely wants a second role of that
// name can still add one by hand, and the resolver's own duplicate check is
// what stops that from creating a copy.
//
// Order: the targeted families first, in the AI's own order, because that is
// where the change is; the untargeted rest follows alphabetically. The order is
// fixed once, here, so a drop into an untargeted family does not make its row
// jump to another place on the screen mid-gesture.
//
// Nothing here reaches the payload: resolveImportTargets derives the write from
// the names and the rows, and a family with no roles contributes neither a
// payload entry nor a count.
export function buildImportSeed(
  proposed: ProposedFamily[],
  existingFamilies: ExistingFamily[],
  existingRoles: ExistingRole[],
  locale: string
): ImportSeed {
  const byName = new Map(
    existingFamilies.map((family) => [norm(family.name), family])
  )
  // Live titles per existing family, the same scoping resolveImportTargets
  // uses: a role filed under no family belongs to no target, and a title taken
  // in one family says nothing about another.
  const takenByFamily = new Map<string, Set<string>>()
  for (const role of existingRoles) {
    if (role.familyId === null) continue
    const key = role.familyId as string
    let titles = takenByFamily.get(key)
    if (titles === undefined) {
      titles = new Set<string>()
      takenByFamily.set(key, titles)
    }
    titles.add(norm(role.title))
  }

  const targeted = new Set<string>()
  let skipped = 0
  const seed: ImportSeedFamily[] = proposed.map((family) => {
    const match = byName.get(norm(family.name))
    if (match !== undefined) targeted.add(match.familyId)
    // Only a family the org already has can hold a title already, so a family
    // this import would create keeps every row the AI proposed for it.
    const taken =
      match === undefined
        ? undefined
        : takenByFamily.get(match.familyId as string)
    const roles =
      taken === undefined
        ? family.roles
        : family.roles.filter((role) => {
            if (!taken.has(norm(role.title))) return true
            skipped += 1
            return false
          })
    return {
      ...(match !== undefined ? { familyId: match.familyId } : {}),
      // The STORED name when the proposal matched one: the family shows it as
      // static text, and it must read as the family the org actually has
      // rather than as the AI's casing of it.
      name: match?.name ?? family.name,
      roles,
    }
  })
  const untargeted = existingFamilies
    .filter((family) => !targeted.has(family.familyId))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
  for (const family of untargeted) {
    seed.push({ familyId: family.familyId, name: family.name, roles: [] })
  }
  return { families: seed, skipped }
}
