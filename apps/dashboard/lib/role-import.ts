import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { MAX_FAMILIES, MAX_ROLES } from "@workspace/constants"
import type { DraftFamily } from "@/lib/family-dnd"

// The org's current families and live roles, as the review needs them.
export interface ExistingFamily {
  familyId: Id<"roleFamilies">
  name: string
}

export interface ExistingRole {
  title: string
  familyId: Id<"roleFamilies"> | null
}

export interface ResolvedRole {
  // The draft row's synthetic id, so the review can look its annotation up.
  id: number
  // The title is already taken by a live role in this row's TARGET family (or
  // by an earlier row aimed at the same family), so the import will skip it.
  // Never set on a row inside a blocked card: nothing from such a card is
  // submitted, so "will be skipped as a duplicate" would name a consequence
  // that is not the one happening and point at the wrong fix.
  duplicate: boolean
  // The row has no title (or only whitespace), so it is dropped from the count.
  // Flagged rather than dropped silently: the row still sits on screen looking
  // like a role, while the CTA's count quietly excludes it.
  blank: boolean
}

export interface ResolvedFamily {
  id: number
  // Set when the card's name matches an existing family: its roles are added
  // into that family. Null means the card would create a new family.
  familyId: Id<"roleFamilies"> | null
  // Another NEW card in the draft claims the same name. Both are marked, and
  // creating is blocked until one is renamed.
  colliding: boolean
  // The trimmed name is empty while the card holds at least one real title:
  // without this signal the card is silently dropped with nothing to show
  // for it. A blank-named card with no usable roles is just an empty card
  // the user added, so it stays false there.
  nameMissing: boolean
  roles: ResolvedRole[]
}

export interface ImportPayloadFamily {
  familyId?: Id<"roleFamilies">
  name: string
  roles: { title: string; trackKey: string }[]
}

// Why the import cannot be created, in priority order:
// - "tooManyRoles" / "tooManyFamilies": the payload exceeds a server limit.
//   These outrank everything else because the server rejects the WHOLE payload
//   with one untargeted invalidInput, and with a hundred rows on screen there
//   is no way to find what went wrong; the per-card messages below still show
//   on their own cards, so nothing is hidden by ranking these first.
// - "cardBlocked": at least one card is colliding or missing its name. Those
//   cards carry their own message, so the review must not add a second,
//   contradictory explanation on top of them.
// - "allDuplicate": nothing is blocked, but every real title the import
//   started with is already taken in its target family (whether the seed
//   dropped it or this pass did).
// - "empty": nothing is blocked and there is no real title left at all (every
//   family was emptied, or the rows are blank), so nothing "already exists".
// Exposed here rather than re-derived per call site: the review's explanatory
// line was once a hand-rolled partial copy of the canCreate terms and claimed
// duplicates for a draft that was actually blocked on a name, or empty.
export type ImportBlocker =
  | "tooManyRoles"
  | "tooManyFamilies"
  | "cardBlocked"
  | "allDuplicate"
  | "empty"

export interface ResolvedImport {
  families: ResolvedFamily[]
  // Exactly what confirmRoleImport should receive.
  payload: ImportPayloadFamily[]
  // `skipped` is every title this import will not create because it already
  // exists: the rows the seed dropped before the review saw them plus the ones
  // this pass marked. It is what the confirm reports as skippedInReview, so
  // the "Already existed" total on the done screen stays true.
  counts: { roles: number; families: number; skipped: number }
  blocker: ImportBlocker | null
  canCreate: boolean
}

const norm = (value: string) => value.trim().toLowerCase()

// Resolves an edited draft against the org's current register: which families
// the draft targets, which titles would be skipped as duplicates, and what
// payload the confirm should receive.
//
// Family identity is DERIVED from the name rather than stored on the draft, so
// renaming a family re-targets it live in both directions: onto an existing
// family (a merge) or off it (a new family). Duplicate marking is derived the
// same way, against each role's CURRENT target, so it stays correct after a
// rename or a drag between families with nothing to keep in sync.
//
// `skippedBeforeReview` is what the SEED already dropped as already-present
// (see buildImportSeed). Those rows are not in the draft and can never be, so
// this pass cannot see them, yet they are skips of exactly the same kind: they
// belong in the same total and they are what makes "every role in your list
// already exists" reachable at all when the whole proposal was duplicates.
// Folding them in here rather than adding them at the call site keeps one
// number behind the gate, the explanation and the reported count, so none of
// the three can disagree with the other two.
export function resolveImportTargets(
  draft: DraftFamily[],
  existingFamilies: ExistingFamily[],
  existingRoles: ExistingRole[],
  skippedBeforeReview = 0
): ResolvedImport {
  const familyByName = new Map(
    existingFamilies.map((family) => [norm(family.name), family])
  )

  // Live titles per existing family. Mutated as this pass accepts titles, so
  // two cards resolving to the SAME existing family cannot both claim one
  // title. A family-less role belongs to no card's scope and is skipped here.
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

  // A card can only be a problem if it would submit something. An empty card
  // (no row holds a real title) contributes nothing to the payload, so the
  // server never sees its name and cannot reject it: counting it would block
  // the whole import over a card that does not exist as far as the write is
  // concerned. Same reasoning as nameMissing, applied to the name collision.
  const hasContent = (family: DraftFamily) =>
    family.roles.some((role) => role.title.trim() !== "")

  // How many NEW cards claim each name, so a collision marks every card
  // involved rather than only the second one.
  const newNameCounts = new Map<string, number>()
  for (const family of draft) {
    const name = norm(family.name)
    if (name === "" || familyByName.has(name) || !hasContent(family)) continue
    newNameCounts.set(name, (newNameCounts.get(name) ?? 0) + 1)
  }

  const families: ResolvedFamily[] = []
  const payload: ImportPayloadFamily[] = []
  let createdRoles = 0
  let createdFamilies = 0
  let skipped = skippedBeforeReview

  for (const family of draft) {
    const name = family.name.trim()
    const lowered = norm(name)
    const match = familyByName.get(lowered)
    const familyId = match?.familyId ?? null
    const contentful = hasContent(family)
    const colliding =
      contentful &&
      match === undefined &&
      lowered !== "" &&
      (newNameCounts.get(lowered) ?? 0) > 1
    // A blank name drops the whole card further down. That is only worth
    // flagging when the card actually holds a real title to lose; a
    // blank-named card with nothing in it is just an empty card the user
    // added.
    const nameMissing = name === "" && contentful
    const cardBlocked = colliding || nameMissing

    // An existing family shares one accumulating set across every card aimed
    // at it; a new family only has to avoid repeating itself.
    let taken: Set<string>
    if (familyId !== null) {
      const key = familyId as string
      let existing = takenByFamily.get(key)
      if (existing === undefined) {
        existing = new Set<string>()
        takenByFamily.set(key, existing)
      }
      taken = existing
    } else {
      taken = new Set<string>()
    }

    const roles: ResolvedRole[] = []
    const payloadRoles: { title: string; trackKey: string }[] = []
    for (const role of family.roles) {
      const title = role.title.trim()
      const key = norm(title)
      const blank = title === ""
      // Nothing from a blocked card is submitted, so no row in it is "already
      // taken, will be skipped": the row would be labelled with a consequence
      // that is not going to happen, and its skip attributed to duplication
      // rather than to the card's real problem. Not marking it here is also
      // what keeps those rows out of counts.skipped below.
      const duplicate = !cardBlocked && !blank && taken.has(key)
      roles.push({ id: role.id, duplicate, blank })
      if (blank) continue
      if (duplicate) {
        skipped += 1
        continue
      }
      taken.add(key)
      payloadRoles.push({ title, trackKey: role.trackKey })
    }
    families.push({ id: family.id, familyId, colliding, nameMissing, roles })

    // A card that will not be submitted (colliding, a missing name, or
    // nothing left to create) contributes nothing further: not to the
    // payload, not to the role/family counts.
    if (cardBlocked || payloadRoles.length === 0) continue
    payload.push({
      ...(familyId !== null ? { familyId } : {}),
      name,
      roles: payloadRoles,
    })
    createdRoles += payloadRoles.length
    if (familyId === null) createdFamilies += 1
  }

  // One derivation for both the gate and the explanation, so a call site can
  // never show a reason that disagrees with whether the button is enabled.
  //
  // The two limits are measured on the PAYLOAD, exactly what the server counts
  // (insertAdditiveRoles: families.length, then the summed roles). Measuring
  // the draft instead would block imports the server would have accepted,
  // because a blocked card, a duplicate row and a blank row are all on screen
  // but never submitted.
  const blocker: ImportBlocker | null =
    createdRoles > MAX_ROLES
      ? "tooManyRoles"
      : payload.length > MAX_FAMILIES
        ? "tooManyFamilies"
        : families.some((family) => family.colliding || family.nameMissing)
          ? "cardBlocked"
          : createdRoles > 0
            ? null
            : skipped > 0
              ? "allDuplicate"
              : "empty"

  return {
    families,
    payload,
    counts: { roles: createdRoles, families: createdFamilies, skipped },
    blocker,
    canCreate: blocker === null,
  }
}
