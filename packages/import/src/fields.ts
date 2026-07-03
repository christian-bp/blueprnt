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

/**
 * Normalize a raw CSV header for synonym lookup:
 * lowercase, NFD-decompose, strip combining diacritics, strip non-alphanumerics.
 */
export function fold(s: string): string {
  return s
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
    ],
  },
  {
    key: "gender",
    tier: "required",
    shape: "gender",
    synonyms: ["kon", "gender", "sex", "kjonn", "koen", "sukupuoli"],
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
      "lon",
      "basicmonthly",
      "basemonthly",
      "fixedmonthly",
      "grundlonmanadslon",
    ],
  },
  // Recommended fields
  {
    key: "firstName",
    tier: "recommended",
    shape: "text",
    synonyms: ["fornamn", "firstname", "givenname", "fname"],
  },
  {
    key: "lastName",
    tier: "recommended",
    shape: "text",
    synonyms: ["efternamn", "lastname", "surname", "familyname", "lname"],
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
    synonyms: ["fodelsedatum", "birthdate", "dob", "dateofbirth", "birthyear"],
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
