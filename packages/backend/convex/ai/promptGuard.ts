// The one seam every AI prompt is assembled through.
//
// TWO invariants live here, and both are defence in depth rather than the
// primary control. The primary control is that the collectors only ever read
// role-level and organization-level rows in the first place; this catches the
// day someone widens a collector, spreads a whole document into a prompt line,
// or adds a prompt path in a hurry.
//
// 1. NEVER FEED OUTCOMES. No score, level, zone, band, or assessment value may
//    enter any prompt. The AI advises the METHOD (which criteria, what they
//    mean, how they are weighted); it must never see where roles LAND under
//    that method. A model that can see the placements can optimize the method
//    toward them, which is exactly the auto-deciding ADR-0003 forbids: the
//    reviewer would then be confirming a suggestion that was reverse-engineered
//    from the answer instead of argued from the work.
//
// 2. NEVER SEND PERSONAL DATA. Role != Person (ADR-0003, GDPR). No individual's
//    name, salary, performance, gender, employment dates, or contact details.
//
// Detection is STRUCTURAL, on serialized object KEYS, never on prose. That is
// not a shortcut, it is the only correct rule here: the criteria library ships
// a criterion literally named "Knowledge depth and specialist level", and the
// weight-review prompt is required to quote criterion names verbatim. A word
// scan for "level" would refuse the app's own legitimate content on day one
// while catching nothing a careless spread actually produces. What a careless
// spread DOES produce is a JSON key: `"score":`, `"level":`, `"salary":`. That
// is what these refuse.

// The outcome family: everything deriveResults produces, plus the placement
// vocabulary around it. A key equal to one of these (case-insensitively) may
// never appear in prompt data.
export const FORBIDDEN_OUTCOME_KEYS: readonly string[] = [
  "score",
  "scores",
  "level",
  "levels",
  "zone",
  "zones",
  "band",
  "bands",
  "rating",
  "ratings",
  "assessment",
  "assessments",
  "levelrules",
  "zoneprofilerules",
  "expectedlevel",
  "profilelimited",
  "calibrated",
  "methoddrift",
  "ratedcount",
]

// The person family. Role-level fields (title, function, team, track, purpose,
// responsibilities) are permitted and are NOT here; these are the fields that
// only ever describe an individual.
export const FORBIDDEN_PERSON_KEYS: readonly string[] = [
  "personid",
  "people",
  "person",
  "salary",
  "salaries",
  "basesalary",
  "monthlysalary",
  "annualsalary",
  "pay",
  "payrecords",
  "gender",
  "birthdate",
  "employeenumber",
  "externalref",
  "displayname",
  "email",
  "performance",
  "seniority",
]

const FORBIDDEN_KEYS = new Set([
  ...FORBIDDEN_OUTCOME_KEYS,
  ...FORBIDDEN_PERSON_KEYS,
])

// Thrown when a prompt path tries to carry data it must never carry. A plain
// Error, not an appError: this is never a condition a user can cause or fix,
// it is a programming mistake, and the calling action's own catch turns it
// into an ordinary generation failure. What must NOT happen is the call going
// out, and that is what throwing here prevents.
export class PromptContaminationError extends Error {
  constructor(key: string, where: string) {
    super(`prompt contamination: forbidden key "${key}" in ${where}`)
    this.name = "PromptContaminationError"
  }
}

// Walks a value the caller intends to put in a prompt and refuses any object
// key in the forbidden families, at any depth, inside arrays too. Key names are
// compared case-insensitively and EXACTLY: "score" is refused, "weightPoints"
// and "scoreCard" are not. Exact matching keeps the guard from creeping into a
// fuzzy filter nobody can predict, and the forbidden names are the ones our own
// wire shapes actually use, which is what makes exactness sufficient.
export function assertPromptDataSafe(value: unknown, where: string): void {
  const seen = new Set<object>()
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== "object") return
    // Cycles cannot occur in the plain data we build, but a guard that can
    // hang on one is worse than useless.
    if (seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    for (const [key, child] of Object.entries(node)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        throw new PromptContaminationError(key, where)
      }
      walk(child)
    }
  }
  walk(value)
}

// Serializes data INTO a prompt. The only sanctioned way to do it: guarding and
// stringifying are one call, so a prompt line cannot carry a structure that was
// never checked.
export function promptJson(value: unknown, where: string): string {
  assertPromptDataSafe(value, where)
  return JSON.stringify(value)
}

// Matches a serialized forbidden key in an already-assembled prompt string:
// `"score":`, `'level' :`, and so on. The backstop for a line that built its
// own JSON without going through promptJson.
const SERIALIZED_KEY = new RegExp(
  `["'](${[...FORBIDDEN_KEYS].join("|")})["']\\s*:`,
  "i"
)

// Assembles a prompt from its lines. EVERY prompt path calls this: joining
// lines with "\n" by hand is refused by the seam guard test, so a new prompt
// cannot quietly skip the check.
export function buildPrompt(lines: readonly string[], where: string): string {
  const prompt = lines.join("\n")
  const match = SERIALIZED_KEY.exec(prompt)
  if (match !== null) {
    throw new PromptContaminationError(match[1] ?? "unknown", where)
  }
  return prompt
}
