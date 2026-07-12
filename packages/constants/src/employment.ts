// Canonical employment-type (anställningsform) values for pay-mapping grouping
// (Del 3.3 #10). Persisted on the people row; never repurpose an existing value.
export const EMPLOYMENT_TYPES = [
  "permanent",
  "fixedTerm",
  "substitute",
  "hourly",
] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

// Folded synonyms per canonical type (lowercased, diacritics/non-alphanumerics
// stripped). Substring match, so "fast anställning" folds to "fastanstallning"
// and matches "fast". Mirrors the folding in @workspace/import fields.fold;
// kept local to avoid a package dependency for five lines.
const EMPLOYMENT_TYPE_SYNONYMS: Record<EmploymentType, readonly string[]> = {
  permanent: ["tillsvidare", "fast", "permanent", "vakinaisuus", "vakituinen"],
  fixedTerm: [
    "visstid",
    "tidsbegransad",
    "temporary",
    "fixedterm",
    "midlertidig",
    "maaraaikainen",
  ],
  substitute: ["vikariat", "vikarie", "vikar", "substitute", "sijaisuus"],
  hourly: ["tim", "hourly", "timelonn", "tuntityo"],
}

const PRE_NFD: ReadonlyArray<readonly [RegExp, string]> = [
  [/[øØ]/g, "o"],
  [/[æÆ]/g, "ae"],
]

function fold(s: string): string {
  let out = s
  for (const [pattern, replacement] of PRE_NFD)
    out = out.replace(pattern, replacement)
  return out
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

// Map a raw payroll string to a canonical employment type, or null when blank
// or unrecognised (soft: the import leaves the field unset, never blocks a row).
export function normalizeEmploymentType(raw: string): EmploymentType | null {
  const f = fold(raw)
  if (!f) return null
  for (const type of EMPLOYMENT_TYPES) {
    if (EMPLOYMENT_TYPE_SYNONYMS[type].some((syn) => f.includes(syn))) {
      return type
    }
  }
  return null
}
