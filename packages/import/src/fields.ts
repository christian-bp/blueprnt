// Canonical field definitions and synonym dictionary for the salary import engine.

import { DEFAULT_BASIS_BY_FIELD, type PayBasis } from "@workspace/constants"

export type FieldTier = "required" | "recommended" | "optional"

export type ValueShape =
  | "id"
  | "text"
  | "money"
  | "percent"
  | "date"
  | "gender"
  | "boolean"
  | "employmentType"

export type FieldDef = {
  key: CanonicalFieldKey
  tier: FieldTier
  shape: ValueShape
  /** Pre-folded header candidates across sv/nb/da/fi/en. */
  synonyms: string[]
}

// Letters that NFD does not decompose to a base ASCII letter. Substituted
// before NFD so they survive the combining-diacritic and non-alphanumeric
// strips below. Fixed table, locale-independent, keeps fold pure.
const PRE_NFD_SUBSTITUTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[øØ]/g, "o"], // o-slash (Norwegian/Danish) -> o
  [/[æÆ]/g, "ae"], // ae ligature (Danish/Norwegian) -> ae
]

/**
 * Normalize a raw CSV header for synonym lookup:
 * pre-NFD substitute the letters NFD cannot decompose (o-slash, ae ligature),
 * then lowercase, NFD-decompose, strip combining diacritics, strip non-alphanumerics.
 */
export function fold(s: string): string {
  let out = s
  for (const [pattern, replacement] of PRE_NFD_SUBSTITUTIONS) {
    out = out.replace(pattern, replacement)
  }
  return out
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

/**
 * Minimum folded length for a synonym to participate in the substring-contains
 * branch of header scoring. Short synonyms (< 5 folded chars) match by exact
 * compare only, so they cannot fire inside longer unrelated words (DC-25).
 */
export const SUBSTRING_MIN_LENGTH = 5

/**
 * Test a folded header against a synonym list.
 * `exact` is true when the folded header equals a synonym.
 * `substring` is true when the folded header contains a synonym of at least
 * SUBSTRING_MIN_LENGTH folded characters. Short synonyms never contribute to
 * `substring`; they must match exactly.
 */
export function matchesSynonym(
  folded: string,
  synonyms: readonly string[]
): { exact: boolean; substring: boolean } {
  for (const syn of synonyms) {
    if (folded === syn) return { exact: true, substring: false }
  }
  for (const syn of synonyms) {
    if (syn.length >= SUBSTRING_MIN_LENGTH && folded.includes(syn)) {
      return { exact: false, substring: true }
    }
  }
  return { exact: false, substring: false }
}

const FIELDS = [
  // Required fields (spec §5.4)
  {
    key: "externalRef",
    tier: "required",
    shape: "id",
    synonyms: [
      "anstnr",
      "anstallningsnummer",
      "anstallnr",
      "ansattnr",
      "employeeid",
      "empno",
      "employeenumber",
      "employeeno",
      "personnummer",
      "persnr",
      "extref",
      "externalref",
      "externalid",
      "henkilonro",
      "pernr",
    ],
  },
  {
    key: "title",
    tier: "required",
    shape: "text",
    synonyms: [
      "befattning",
      "titel",
      "roll",
      "jobtitle",
      "position",
      "stilling",
      "title",
      "jobposition",
      "jobroll",
      "tehtavanimike",
      "nimike",
      "tjanstebenamning",
      "benamning",
      "plans",
    ],
  },
  {
    key: "gender",
    tier: "required",
    shape: "gender",
    synonyms: ["kon", "gender", "sex", "kjonn", "sukupuoli", "gesch"],
  },
  {
    key: "basicMonthly",
    tier: "required",
    shape: "money",
    synonyms: [
      "lon",
      "manadslon",
      "grundlon",
      "fastmanadslon",
      "monthlysalary",
      "basesalary",
      "basicmonthly",
      "basemonthly",
      "fixedmonthly",
      "grundlonmanadslon",
      "peruspalkka",
      "kuukausipalkka",
      "grunnlonn",
      "grundlonn",
      "manadsarvode",
      "arvode",
      "basepay",
      "salary",
      "annualsalary",
      "grosssalary",
      "ansal",
    ],
  },
  // Recommended fields
  {
    key: "firstName",
    tier: "recommended",
    shape: "text",
    synonyms: ["fornamn", "firstname", "givenname", "fname", "fornavn"],
  },
  {
    key: "lastName",
    tier: "recommended",
    shape: "text",
    synonyms: [
      "efternamn",
      "lastname",
      "surname",
      "familyname",
      "lname",
      "etternavn",
    ],
  },
  {
    key: "ftePercent",
    tier: "recommended",
    shape: "percent",
    synonyms: [
      "sysselsattningsgrad",
      "sysselssattningsgrad",
      "tjanstgoringsgrad",
      "omfattning",
      "fte",
      "ftepercent",
      "sysselsattning",
      "tjgrad",
      "tjgradprocent",
      "tjanstggrad",
      "stillingsprosent",
      "beskaeftigelsesgrad",
    ],
  },
  {
    key: "payYear",
    tier: "recommended",
    shape: "id",
    synonyms: [
      "lonear",
      "salaryyear",
      "year",
      "payyear",
      "lon ar",
      "lonaret",
    ].map(fold),
  },
  {
    key: "birthDate",
    tier: "recommended",
    shape: "date",
    synonyms: [
      "fodelsedatum",
      "birthdate",
      "dob",
      "dateofbirth",
      "birthyear",
      "fodselsdato",
    ],
  },
  {
    key: "employmentStartDate",
    tier: "recommended",
    shape: "date",
    synonyms: [
      "anstallningsdatum",
      "hiredate",
      "startdate",
      "employmentstartdate",
      "anstallningsdag",
      "joiningdate",
      "anstdag",
      "anstdatum",
      "mandag",
    ],
  },
  {
    key: "statisticalCode",
    tier: "recommended",
    shape: "id",
    synonyms: [
      "statistikkod",
      "ssyk",
      "occupationcode",
      "statisticalcode",
      "jobcode",
      "yrkeskod",
    ],
  },
  // Optional fields
  {
    key: "variable",
    tier: "optional",
    shape: "money",
    // "malbonus"/"bonus" removed (Task 3): they now belong exclusively to the
    // dedicated "bonus" field below, so a "Bonus"/"Målbonus" header resolves
    // unambiguously instead of tying on array-index order between two
    // distinct optional money fields.
    synonyms: [
      "variable",
      "variabel",
      "variabellonn",
      "variabellon",
      "rorliglon",
    ],
  },
  {
    key: "benefitInKind",
    tier: "optional",
    shape: "money",
    synonyms: [
      "tjanstebil",
      "formansbil",
      "benefit",
      "carbenefit",
      "benefitinkind",
      "forman",
      "naturalforman",
    ],
  },
  {
    key: "bonus",
    tier: "optional",
    shape: "money",
    synonyms: [
      "bonus",
      "arsbonus",
      "annualbonus",
      "yearbonus",
      "resultatbonus",
      "malbonus",
    ],
  },
  {
    key: "fixedSupplement",
    tier: "optional",
    shape: "money",
    synonyms: [
      "fasttillagg",
      "fixedsupplement",
      "fastlonetillagg",
      "fasttillaegg",
      "lonetillagg",
    ],
  },
  {
    key: "allowance",
    tier: "optional",
    shape: "money",
    synonyms: [
      "ersattning",
      "allowance",
      "obtillagg",
      "skifttillagg",
      "traktamente",
      "tillaeg",
    ],
  },
  {
    key: "equity",
    tier: "optional",
    shape: "money",
    synonyms: [
      "aktier",
      "equity",
      "optioner",
      "aktieprogram",
      "incitament",
      "aksjer",
    ],
  },
  {
    key: "other",
    tier: "optional",
    shape: "money",
    synonyms: [
      "ovrigersattning",
      "ovrigttillagg",
      "otheraddition",
      "othercomp",
      "annengodtgjorelse",
    ],
  },
  {
    key: "employmentType",
    tier: "recommended",
    shape: "employmentType",
    synonyms: [
      "anstallningsform",
      "anstform",
      "employmenttype",
      "employmentform",
      "contracttype",
      "ansettelsesform",
      "ansaettelsesform",
      "palvelussuhde",
    ],
  },
  {
    key: "currency",
    tier: "optional",
    shape: "text",
    synonyms: ["valuta", "currency", "currencycode"],
  },
  {
    key: "country",
    tier: "optional",
    shape: "text",
    synonyms: ["land", "country", "countrycode", "nation"],
  },
  {
    key: "department",
    tier: "optional",
    shape: "text",
    synonyms: ["avdelning", "department", "dept", "enhet", "division"],
  },
  {
    key: "isManager",
    tier: "optional",
    shape: "boolean",
    synonyms: ["chef", "manager", "ismanager", "ledarroll", "managerflag"],
  },
] as const

// Fold any synonyms that may not have been pre-folded (defensive, handles raw strings).
function normalizeSynonyms(synonyms: readonly string[]): string[] {
  return synonyms.map(fold)
}

export const CANONICAL_FIELDS: readonly FieldDef[] = FIELDS.map((f) => ({
  ...f,
  synonyms: normalizeSynonyms(f.synonyms),
})) as unknown as readonly FieldDef[]

export type CanonicalFieldKey = (typeof FIELDS)[number]["key"]

// Folded header fragments that imply an annual figure regardless of the field
// (e.g. an "Årslön" column mapped to base salary). Used to seed the Map-step
// basis toggle to "annual" so the common annual-column case is one click.
export const ANNUAL_HINT: readonly string[] = [
  "arslon",
  "arslonn",
  "annualsalary",
  "yearlysalary",
  "arsbonus",
  "annualbonus",
  "arsinkomst",
  "arsersattning",
].map(fold)

// Pure: the default monthly/annual basis for a mapped money column. An
// annual-flavoured header wins; otherwise the field's default; otherwise
// monthly. Used client-side (Map step) to seed the toggle.
export function defaultBasis(fieldKey: string, rawHeader: string): PayBasis {
  const folded = fold(rawHeader)
  if (ANNUAL_HINT.some((hint) => folded.includes(hint))) return "annual"
  return (
    DEFAULT_BASIS_BY_FIELD[fieldKey as keyof typeof DEFAULT_BASIS_BY_FIELD] ??
    "monthly"
  )
}
