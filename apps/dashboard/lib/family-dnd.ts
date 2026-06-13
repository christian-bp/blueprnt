// Pure list operations behind the families-review drag and drop, plus the
// draft types shared by the families onboarding step. Kept out of the
// component so the move semantics are unit-testable without simulating
// pointer events (the full drag interaction is e2e scope).

import type { Id } from "@workspace/backend/convex/_generated/dataModel"

// The synthetic numeric `id` is the dnd/React key (always present, unique
// across all families and roles). `roleId`/`familyId` are the REAL backend
// ids, carried invisibly when the draft is seeded from already-created data
// so finish() can reconcile against the stored set; they stay undefined for
// rows the user adds, which reconcile then treats as new.
export interface DraftRole {
  id: number
  roleId?: Id<"roles">
  title: string
  trackKey: string
}

export interface DraftFamily {
  id: number
  familyId?: Id<"roleFamilies">
  name: string
  roles: DraftRole[]
}

export function findFamilyIdByRole(
  families: DraftFamily[],
  roleId: number
): number | null {
  for (const family of families) {
    if (family.roles.some((role) => role.id === roleId)) return family.id
  }
  return null
}

// Moves a role into ANOTHER family, in front of beforeRoleId when given and
// present, otherwise to the end. In-family ordering is reorderRoleWithinFamily's
// job; same-family calls and unknown ids are no-ops returning the INPUT
// reference, so a setState with the result bails out of re-rendering.
export function moveRoleToFamily(
  families: DraftFamily[],
  roleId: number,
  targetFamilyId: number,
  beforeRoleId?: number
): DraftFamily[] {
  const sourceFamilyId = findFamilyIdByRole(families, roleId)
  if (
    sourceFamilyId === null ||
    sourceFamilyId === targetFamilyId ||
    !families.some((family) => family.id === targetFamilyId)
  ) {
    return families
  }
  // Resolve the moved role up front: the target family can come before the
  // source family in the array, so resolving inside the map would miss it.
  const moved = families
    .find((family) => family.id === sourceFamilyId)
    ?.roles.find((role) => role.id === roleId)
  if (moved === undefined) return families
  return families.map((family) => {
    if (family.id === sourceFamilyId) {
      return {
        ...family,
        roles: family.roles.filter((role) => role.id !== roleId),
      }
    }
    if (family.id === targetFamilyId) {
      const index =
        beforeRoleId !== undefined
          ? family.roles.findIndex((role) => role.id === beforeRoleId)
          : -1
      const roles = [...family.roles]
      roles.splice(index === -1 ? roles.length : index, 0, moved)
      return { ...family, roles }
    }
    return family
  })
}

// Reorders a role within its own family so it lands at the position of
// overRoleId (the dnd-kit sortable arrayMove semantics). Cross-family pairs
// and unknown ids are no-ops returning the INPUT reference, so a setState
// with the result bails out of re-rendering.
export function reorderRoleWithinFamily(
  families: DraftFamily[],
  roleId: number,
  overRoleId: number
): DraftFamily[] {
  if (roleId === overRoleId) return families
  const familyId = findFamilyIdByRole(families, roleId)
  if (
    familyId === null ||
    familyId !== findFamilyIdByRole(families, overRoleId)
  ) {
    return families
  }
  return families.map((family) => {
    if (family.id !== familyId) return family
    const fromIndex = family.roles.findIndex((role) => role.id === roleId)
    const toIndex = family.roles.findIndex((role) => role.id === overRoleId)
    const roles = [...family.roles]
    const [moved] = roles.splice(fromIndex, 1)
    if (moved === undefined) return family
    roles.splice(toIndex, 0, moved)
    return { ...family, roles }
  })
}

// The payload shape createStarterSet/confirmStarterImport accept: trimmed
// names and titles, empty roles and nameless families dropped (the explicit
// way to create nothing is emptying the list). Drops the ids: the create
// mutations only take name/title/trackKey.
export function cleanDraftFamilies(
  families: DraftFamily[]
): { name: string; roles: { title: string; trackKey: string }[] }[] {
  return families
    .map((family) => ({
      name: family.name.trim(),
      roles: family.roles
        .map((role) => ({ title: role.title.trim(), trackKey: role.trackKey }))
        .filter((role) => role.title !== ""),
    }))
    .filter((family) => family.name !== "")
}

// The reconcileStarterSet payload shape: the same trim/drop cleaning as
// cleanDraftFamilies, but carrying the real familyId/roleId so the server can
// diff against the stored set (ids omitted when undefined, i.e. new rows, so
// the v.optional validators are satisfied). Removing a family/role here simply
// drops it from the payload, which reconcile reads as "archive it".
export function cleanDraftFamiliesWithIds(families: DraftFamily[]): {
  familyId?: Id<"roleFamilies">
  name: string
  roles: { roleId?: Id<"roles">; title: string; trackKey: string }[]
}[] {
  return families
    .map((family) => ({
      ...(family.familyId !== undefined ? { familyId: family.familyId } : {}),
      name: family.name.trim(),
      roles: family.roles
        .map((role) => ({
          ...(role.roleId !== undefined ? { roleId: role.roleId } : {}),
          title: role.title.trim(),
          trackKey: role.trackKey,
        }))
        .filter((role) => role.title !== ""),
    }))
    .filter((family) => family.name !== "")
}
