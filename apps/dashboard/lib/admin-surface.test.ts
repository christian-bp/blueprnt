import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// THE RULE: admin means ORG ADMINISTRATION and the AUDIT LOG. The
// organization's own settings, name, avatar, onboarding completion and member
// list, plus reading the trail. Everything else an organization does, the
// evaluation model (including approving and restoring it), roles, people
// (including the payroll import and archiving) and the AI actions, is
// member-level work that both roles perform.
//
// ONE product function is carved out of that: erasing a person. It is the only
// irreversible destruction the app offers, and least privilege puts it with
// the administrators rather than with everyday work.
//
// This pins the whole admin surface as one list. A new admin gate becomes a
// deliberate edit here, with a reviewer looking at it, rather than a wrapper
// someone reached for out of habit; and a gate quietly added to a model or
// people function fails the suite instead of shipping a role split nobody
// decided.
//
// A gate wears one of three shapes, and all three are scanned, because the
// commit that established this rule had to find two of the third kind by
// grep: the wrappers, the action gate, and a bare `role !== "admin"` branch
// inside an otherwise member-level handler. The third has no single tell, so
// it is pinned three ways over: the canonical error code, a read of ctx.role,
// and any comparison against the "admin" literal whatever it then throws.
//
// Every scan reads source with its COMMENTS BLANKED OUT. This codebase's
// comments routinely name the mechanism a function is deliberately not using,
// and a guard that failed on a sentence would report a security regression
// where there is prose.
//
// It lives in the dashboard's suite, beside backend-imports.test.ts and for the
// same reason: both scan backend SOURCE from disk, and the backend's own suite
// runs in edge-runtime, where there is no filesystem to scan with.
const BACKEND = join(process.cwd(), "../../packages/backend/convex")

// file -> the exports it may gate on admin, by wrapper.
const ADMIN_SURFACE: Record<string, string[]> = {
  // Reading the trail. The writes it records are member-level; who may READ
  // the organization's whole history is an administration question.
  "accounts/audit.ts": ["getAuditLogPage", "searchAuditLog"],
  // Org administration proper.
  "accounts/organization.ts": [
    "updateOrganizationSettings",
    "completeOnboarding",
    "removeOrgAvatar",
    "updateOrganizationName",
    "listOrgMembers",
    "updateMemberRole",
    "removeMember",
  ],
  // The gate's own probe: a mutation that does nothing, so the wrapper tests
  // can assert it still refuses an editor without depending on a product
  // surface whose role may change.
  "accounts/context.ts": ["touchOrganization"],
  // The ONE product function outside org administration that is admin-gated,
  // by owner decision: least privilege for irreversible destruction. Erasing a
  // person cannot be undone by anyone, so the org's administrators own it,
  // while the everyday person work around it (the payroll import, editing a
  // record, archiving someone who has left) stays member-level like the rest
  // of the people surface.
  "people/erase.ts": ["erasePersonAsOrg"],
}

// file -> the exports that may call the ACTION gate. Named, not merely
// file-listed: an action gate added to a new export inside an
// already-listed file is exactly the drift this guard exists to catch.
const ADMIN_ACTION_SURFACE: Record<string, string[]> = {
  // The org avatar upload is an action because it carries a blob.
  "accounts/organization.ts": ["setOrgAvatar"],
}

// The wrappers and the action gate, by the names they are imported under.
// Aliasing would defeat every scan below, so it is asserted against rather
// than parsed around: nothing in this repo has a reason to rename them.
const GATE_NAMES = ["adminMutation", "adminQuery", "requireOrgAdminAction"]
const ALIASED_IMPORT = new RegExp(
  `\\b(?:${GATE_NAMES.join("|")})\\s+as\\s+\\w+`,
  "g"
)

const ADMIN_WRAPPED =
  /^export\s+const\s+(\w+)\s*=\s*(?:adminMutation|adminQuery)\s*\(/gm
const ADMIN_ACTION_GATE = /requireOrgAdminAction\s*\(\s*ctx\b/g
// Every export in a file, in source order, so a gate call can be attributed to
// the export it sits inside.
const EXPORTED_CONST = /^export\s+const\s+(\w+)\s*=/gm

// An in-handler admin branch: the shape that passes both scans above while
// gating a member-level function just as hard. It may exist only where the
// gates themselves are defined and where the code is declared.
const IN_HANDLER_GATE = /ERROR_CODES\.adminRequired/g
const GATE_DEFINITION_FILES = ["lib/functions.ts", "lib/errors.ts"]
// Reading ctx.role is not a gate by itself (the shell is told its own role),
// but branching on it is how one gets written, so the readers are pinned too.
// Word-bounded: a future ctx.roleFamily is a different field, not this one.
const CTX_ROLE = /ctx\.role\b/g
const CTX_ROLE_FILES = ["lib/functions.ts", "accounts/context.ts"]
// The residue of the two scans above: a branch that reads the role from
// somewhere else (a membership row) and throws something other than the
// canonical code passes both, and that is one of the two hand-found gates
// minus its error code. Comparing against the literal is the tell that
// survives either substitution, so every comparison is pinned to the files
// that legitimately make one. Three today, and none of them a gate:
const ADMIN_COMPARISON = /[!=]==\s*["']admin["']/g
const ADMIN_COMPARISON_FILES = [
  // Defines the wrappers: this is where the admin check belongs.
  "lib/functions.ts",
  // Counts an org's admins so the last one cannot delete their own account.
  "accounts/account.ts",
  // isSoleAdmin, a demotion guard INSIDE mutations that are already
  // admin-gated by their wrapper.
  "accounts/organization.ts",
]
// The platform tables carry no "admin" comparison at all (a platform admin is
// a boolean on the users mirror, checked by requirePlatformAdmin), so the
// platform files need no entry here.

// Comments blanked, whitespace and line structure preserved, so an offender's
// position still reads true and `^export` still anchors. Not a parser: a "//"
// inside a string literal would be treated as a comment, which can only ever
// HIDE text from a scan, never invent a match, and the known-positive checks
// below prove the real shapes still land. The [^:] guard keeps a URL's "//"
// out of it, the one such literal that actually occurs.
const blank = (text: string) => text.replace(/[^\n]/g, " ")
const withoutComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(
      /(^|[^:])(\/\/[^\n]*)/g,
      (_match, before: string, comment: string) => before + blank(comment)
    )

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "_generated" || entry === "node_modules") continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out)
    } else if (path.endsWith(".ts") && !path.endsWith(".test.ts")) {
      out.push(path)
    }
  }
  return out
}

const files = sourceFiles(BACKEND)
const relative = (path: string) => path.slice(BACKEND.length + 1)
const read = (file: string) => readFileSync(file, "utf8")
// What every scan below actually sees.
const scan = (file: string) => withoutComments(read(file))

// A gate call that sits above the file's first export belongs to no export.
// It is named rather than dropped: extracting a shared check into a
// module-level helper is a plausible refactor, and in a file whose helpers all
// precede its exports (the payroll import) that helper lands exactly here. A
// dropped hit would take its whole file out of the comparison and pass.
const MODULE_SCOPE = "<module scope>"

// The export each match sits inside: the last `export const` declared before
// it. Attribution by position rather than by brace matching, which is enough
// here because a gate call lives either inside an exported function's body or
// above every export, and both are answered.
function enclosingExports(source: string, matcher: RegExp): string[] {
  const exports = [...source.matchAll(EXPORTED_CONST)]
    .map((match) => ({ index: match.index ?? 0, name: match[1] ?? "" }))
    .reverse()
  const found = new Set<string>()
  for (const hit of source.matchAll(matcher)) {
    const at = hit.index ?? 0
    const owner = exports.find((entry) => entry.index < at)
    found.add(owner?.name ?? MODULE_SCOPE)
  }
  return [...found]
}

// Both sides sorted before comparing: reordering two exports inside a file is
// not a security change, and a guard that failed on it would read like one.
const sortedEntries = (surface: Record<string, string[]>) =>
  Object.fromEntries(
    Object.entries(surface).map(([file, names]) => [file, [...names].sort()])
  )

describe("the admin surface", () => {
  it("is exactly the org administration and audit-log functions", () => {
    const found: Record<string, string[]> = {}
    for (const file of files) {
      const names = [...scan(file).matchAll(ADMIN_WRAPPED)].flatMap((match) =>
        match[1] === undefined ? [] : [match[1]]
      )
      if (names.length > 0) found[relative(file)] = names
    }
    expect(sortedEntries(found)).toEqual(sortedEntries(ADMIN_SURFACE))
  })

  it("gates exactly those actions, by name", () => {
    const found: Record<string, string[]> = {}
    for (const file of files) {
      // The wrapper's own definition names its ctx parameter the same way a
      // call site does, so the file that DEFINES the gate is excluded here for
      // the reason the known-positive test states below.
      if (relative(file) === "lib/functions.ts") continue
      const names = enclosingExports(scan(file), ADMIN_ACTION_GATE)
      if (names.length > 0) found[relative(file)] = names
    }
    expect(sortedEntries(found)).toEqual(sortedEntries(ADMIN_ACTION_SURFACE))
  })

  // The class the scans above cannot see: a handler that takes the member
  // wrapper and then refuses an editor itself. Two of exactly this shape had
  // to be found by hand when the rule was established (a weight review's
  // dismiss, a compliance draft's context read), and a third would have
  // shipped silently. The error code is the tell, so the code is what is
  // pinned: it may be named where the gates are defined, and nowhere else.
  it("hides no admin branch inside a member-level handler", () => {
    const offenders = files
      .filter((file) => !GATE_DEFINITION_FILES.includes(relative(file)))
      .filter((file) => [...scan(file).matchAll(IN_HANDLER_GATE)].length > 0)
    expect(offenders.map(relative)).toEqual([])

    const roleReaders = files
      .filter((file) => !CTX_ROLE_FILES.includes(relative(file)))
      .filter((file) => [...scan(file).matchAll(CTX_ROLE)].length > 0)
    expect(roleReaders.map(relative)).toEqual([])
  })

  // And the same branch written without either tell: the role read from a
  // membership row, the refusal thrown as some other code. Comparing against
  // the literal is what it cannot avoid doing.
  it("compares against the admin literal only where that is not a gate", () => {
    const comparing = files
      .filter((file) => !ADMIN_COMPARISON_FILES.includes(relative(file)))
      .filter((file) => [...scan(file).matchAll(ADMIN_COMPARISON)].length > 0)
    expect(comparing.map(relative)).toEqual([])
  })

  // Aliasing would slip past every regex above. Nothing renames these imports
  // today, and the guard says so rather than pretending to parse around it.
  it("imports the gates under their own names", () => {
    const aliased = files.filter(
      (file) => [...scan(file).matchAll(ALIASED_IMPORT)].length > 0
    )
    expect(aliased.map(relative)).toEqual([])
  })

  // The scanners are only worth having if they can see a gate. lib/functions.ts
  // DEFINES the wrappers and gates nothing, which is why it is absent from the
  // allowlists: a definition is not a call site, and a scanner that could not
  // tell them apart would either fail here forever or match nothing at all.
  it("can tell a definition from a gated call site", () => {
    const wrappers = read(join(BACKEND, "lib/functions.ts"))
    expect(wrappers).toContain("export const adminMutation")
    expect([...withoutComments(wrappers).matchAll(ADMIN_WRAPPED)]).toEqual([])

    const gated = scan(join(BACKEND, "accounts/audit.ts"))
    expect(
      [...gated.matchAll(ADMIN_WRAPPED)].map((match) => match[1])
    ).toContain("getAuditLogPage")

    // The action scan attributes a gate call to its own export.
    const withAction = scan(join(BACKEND, "accounts/organization.ts"))
    expect(enclosingExports(withAction, ADMIN_ACTION_GATE)).toEqual([
      "setOrgAvatar",
    ])

    // And the four scans that assert an EMPTY result see their own quarry
    // when it is there: without this they would pass on a broken pattern.
    const sample = withoutComments(
      [
        "export const x = orgMutation({ handler: async (ctx) => {",
        '  if (ctx.role !== "admin") throw appError(ERROR_CODES.adminRequired)',
        '  if (membership.role !== "admin") throw appError(ERROR_CODES.notFound)',
        "} })",
        'import { adminMutation as gate } from "../lib/functions"',
      ].join("\n")
    )
    expect([...sample.matchAll(IN_HANDLER_GATE)]).toHaveLength(1)
    expect([...sample.matchAll(CTX_ROLE)]).toHaveLength(1)
    expect([...sample.matchAll(ADMIN_COMPARISON)]).toHaveLength(2)
    expect([...sample.matchAll(ALIASED_IMPORT)]).toHaveLength(1)
  })

  // The other half of the same claim: the scans must NOT fire on a sentence
  // about a gate, or on a field that merely starts with the same letters.
  it("reads code, not prose", () => {
    const prose = withoutComments(
      [
        "// Deliberately does not branch on ctx.role, and never throws",
        "// ERROR_CODES.adminRequired: this is member-level work.",
        '/* Nor does it ask whether role === "admin" anywhere,',
        '   not even as membership.role !== "admin". */',
        "const cached = ctx.roleFamilyIndex",
        'const docs = "https://example.test/guide"',
      ].join("\n")
    )
    expect([...prose.matchAll(IN_HANDLER_GATE)]).toEqual([])
    expect([...prose.matchAll(CTX_ROLE)]).toEqual([])
    expect([...prose.matchAll(ADMIN_COMPARISON)]).toEqual([])
    // A URL's own "//" survives, which is the one string literal in this
    // codebase that carries the sequence.
    expect(prose).toContain("https://example.test/guide")
    // Blanking, not deleting: an offender's line number still reads true.
    expect(prose.split("\n")).toHaveLength(6)
  })

  // A gate call above the file's first export is attributed to the module
  // rather than dropped, or its whole file leaves the comparison and passes.
  it("names a gate that sits above every export", () => {
    const helperFirst = [
      "async function gateIt(ctx: ActionCtx, orgId: string) {",
      "  await requireOrgAdminAction(ctx, orgId)",
      "}",
      "export const later = action({ handler: async () => null })",
    ].join("\n")
    expect(enclosingExports(helperFirst, ADMIN_ACTION_GATE)).toEqual([
      MODULE_SCOPE,
    ])
  })
})
