// Pure list operations behind the families-review drag and drop, plus the
// draft types shared by the families onboarding step. Kept out of the
// component so the move semantics are unit-testable without simulating
// pointer events (the full drag interaction is e2e scope).

export interface DraftRole {
  id: number
  title: string
  trackKey: string
}

export interface DraftFamily {
  id: number
  name: string
  roles: DraftRole[]
}

export function findFamilyIdByRole(
  families: readonly DraftFamily[],
  roleId: number
): number | null {
  for (const family of families) {
    if (family.roles.some((role) => role.id === roleId)) return family.id
  }
  return null
}

// Moves a role into ANOTHER family, in front of beforeRoleId when given and
// present, otherwise to the end. In-family ordering is reorderRoleWithinFamily's
// job; same-family calls and unknown ids are no-ops returning the input.
export function moveRoleToFamily(
  families: readonly DraftFamily[],
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
    return [...families]
  }
  // Resolve the moved role up front: the target family can come before the
  // source family in the array, so resolving inside the map would miss it.
  const moved = families
    .find((family) => family.id === sourceFamilyId)
    ?.roles.find((role) => role.id === roleId)
  if (moved === undefined) return [...families]
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
// and unknown ids are no-ops returning the input.
export function reorderRoleWithinFamily(
  families: readonly DraftFamily[],
  roleId: number,
  overRoleId: number
): DraftFamily[] {
  if (roleId === overRoleId) return [...families]
  const familyId = findFamilyIdByRole(families, roleId)
  if (
    familyId === null ||
    familyId !== findFamilyIdByRole(families, overRoleId)
  ) {
    return [...families]
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
