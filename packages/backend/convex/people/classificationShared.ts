import { suggestLevelForPerson, suggestRoleForTitles } from "@workspace/core"
import type { Doc } from "../_generated/dataModel"

// One title group: the exact imported title (or null for the no-title bucket),
// the people sharing it, the engine's role suggestion for the group, and the
// per-person level suggestion keyed by person id. Both the writer
// (runClassificationSuggestions/classifyOrg) and the reader (listPeopleByTitle)
// consume this so the suggestion is computed once, identically.
export interface TitleGroup {
  title: string | null
  people: Doc<"people">[]
  suggestedRoleId: string | null
  // person._id (as string) -> engine level suggestion, or null when the group
  // matched no role (no track to draw a level from).
  suggestedLevelByPerson: Map<string, string | null>
}

// Groups active people by their exact title string (the no-title bucket keyed
// null), builds the POSITIONAL engine inputs, runs suggestRoleForTitles + a
// per-person suggestLevelForPerson, and returns one TitleGroup per distinct
// title. Titled groups come first (ascending by title), the null-title group
// last. `now` is passed so the engine's clock is caller-controlled (purity).
export function buildTitleGroups(
  people: readonly Doc<"people">[],
  roles: readonly Doc<"roles">[],
  now: number
): TitleGroup[] {
  // Bucket by title; the no-title bucket is keyed with the empty string here and
  // surfaced as title: null in the result.
  const NO_TITLE = ""
  const byTitle = new Map<string, Doc<"people">[]>()
  for (const person of people) {
    const key =
      person.title !== undefined && person.title.trim().length > 0
        ? person.title
        : NO_TITLE
    const bucket = byTitle.get(key) ?? []
    bucket.push(person)
    byTitle.set(key, bucket)
  }

  // Only titled groups are matchable. Build the positional engine inputs:
  // TitleInput carries `hasManager` (true if ANY person under the title is a
  // manager); RoleCandidate carries `roleId` (the role's _id as a string).
  const titledEntries = [...byTitle.entries()].filter(
    ([key]) => key !== NO_TITLE
  )
  const titleInputs = titledEntries.map(([importedTitle, group]) => ({
    importedTitle,
    personCount: group.length,
    hasManager: group.some((p) => p.isManager === true),
  }))
  const roleInputs = roles.map((r) => ({
    roleId: r._id as string,
    title: r.title,
    trackKey: r.trackKey,
  }))
  // POSITIONAL call: (titles, roles). Plan 1 is authoritative on the signature.
  const suggestions = suggestRoleForTitles(titleInputs, roleInputs)
  const suggestionByTitle = new Map(
    suggestions.map((s) => [s.importedTitle, s])
  )
  const roleById = new Map(roles.map((r) => [r._id as string, r]))

  const titled: TitleGroup[] = titledEntries
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([title, group]) => {
      const suggestion = suggestionByTitle.get(title)
      const suggestedRoleId = suggestion?.suggestedRoleId ?? null
      const role =
        suggestedRoleId !== null ? roleById.get(suggestedRoleId) : undefined
      const suggestedLevelByPerson = new Map<string, string | null>()
      for (const person of group) {
        suggestedLevelByPerson.set(
          person._id as string,
          role === undefined
            ? null
            : suggestLevelForPerson({
                trackKey: role.trackKey,
                ...(person.title !== undefined ? { title: person.title } : {}),
                ...(person.employmentStartDate !== undefined
                  ? { employmentStartDate: person.employmentStartDate }
                  : {}),
                today: now,
              }).suggestedLevel
        )
      }
      return {
        title,
        people: group,
        suggestedRoleId,
        suggestedLevelByPerson,
      }
    })

  const untitled = byTitle.get(NO_TITLE)
  if (untitled === undefined) return titled
  return [
    ...titled,
    {
      title: null,
      people: untitled,
      suggestedRoleId: null,
      suggestedLevelByPerson: new Map(
        untitled.map((p) => [p._id as string, null])
      ),
    },
  ]
}
