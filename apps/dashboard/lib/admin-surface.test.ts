import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// THE RULE: admin means ORG ADMINISTRATION and the AUDIT LOG. The
// organization's own settings, name, avatar, onboarding completion and member
// list, plus reading the trail. Everything else an organization does, the
// evaluation model (including approving and restoring it), roles, people
// (including the import and the erasure), and the AI actions, is member-level
// work that both roles perform.
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
// inside an otherwise member-level handler.
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
const CTX_ROLE = /ctx\.role/g
const CTX_ROLE_FILES = ["lib/functions.ts", "accounts/context.ts"]

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

// The export each match sits inside: the last `export const` declared before
// it. Attribution by position rather than by brace matching, which is enough
// here because every gate call lives inside an exported function's body.
function enclosingExports(source: string, matcher: RegExp): string[] {
  const exports = [...source.matchAll(EXPORTED_CONST)].map((match) => ({
    index: match.index ?? 0,
    name: match[1] ?? "",
  }))
  const found = new Set<string>()
  for (const hit of source.matchAll(matcher)) {
    const at = hit.index ?? 0
    const owner = [...exports].reverse().find((entry) => entry.index < at)
    if (owner !== undefined) found.add(owner.name)
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
      const names = [...read(file).matchAll(ADMIN_WRAPPED)].flatMap((match) =>
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
      const names = enclosingExports(read(file), ADMIN_ACTION_GATE)
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
      .filter((file) => [...read(file).matchAll(IN_HANDLER_GATE)].length > 0)
    expect(offenders.map(relative)).toEqual([])

    const roleReaders = files
      .filter((file) => !CTX_ROLE_FILES.includes(relative(file)))
      .filter((file) => [...read(file).matchAll(CTX_ROLE)].length > 0)
    expect(roleReaders.map(relative)).toEqual([])
  })

  // Aliasing would slip past every regex above. Nothing renames these imports
  // today, and the guard says so rather than pretending to parse around it.
  it("imports the gates under their own names", () => {
    const aliased = files.filter(
      (file) => [...read(file).matchAll(ALIASED_IMPORT)].length > 0
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
    expect([...wrappers.matchAll(ADMIN_WRAPPED)]).toEqual([])

    const gated = read(join(BACKEND, "accounts/audit.ts"))
    expect(
      [...gated.matchAll(ADMIN_WRAPPED)].map((match) => match[1])
    ).toContain("getAuditLogPage")

    // The action scan attributes a gate call to its own export.
    const withAction = read(join(BACKEND, "accounts/organization.ts"))
    expect(enclosingExports(withAction, ADMIN_ACTION_GATE)).toEqual([
      "setOrgAvatar",
    ])

    // And the three scans that assert an EMPTY result see their own quarry
    // when it is there: without this they would pass on a broken pattern.
    const sample = [
      "export const x = orgMutation({ handler: async (ctx) => {",
      '  if (ctx.role !== "admin") throw appError(ERROR_CODES.adminRequired)',
      "} })",
      'import { adminMutation as gate } from "../lib/functions"',
    ].join("\n")
    expect([...sample.matchAll(IN_HANDLER_GATE)]).toHaveLength(1)
    expect([...sample.matchAll(CTX_ROLE)]).toHaveLength(1)
    expect([...sample.matchAll(ALIASED_IMPORT)]).toHaveLength(1)
  })
})
