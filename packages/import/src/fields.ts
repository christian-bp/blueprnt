// Canonical field definitions and synonym dictionary for the salary import engine.

export type FieldTier = "required" | "recommended" | "optional"

export type ValueShape =
  | "id"
  | "text"
  | "money"
  | "percent"
  | "date"
  | "gender"
  | "boolean"

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
    synonyms: ["kon", "gender", "sex", "kjonn", "koen", "sukupuoli", "gesch"],
  },
  {
    key: "basicMonthly",
    tier: "required",
    shape: "money",
    synonyms: [
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
    synonyms: [
      "malbonus",
      "bonus",
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
