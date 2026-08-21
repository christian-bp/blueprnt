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
// It lives in the dashboard's suite, beside backend-imports.test.ts and for the
// same reason: both scan backend SOURCE from disk, and the backend's own suite
// runs in edge-runtime, where there is no filesystem to scan with.
const BACKEND = join(process.cwd(), "../../packages/backend/convex")

// file -> the exports it may gate on admin.
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

// Action-context gates take no wrapper, so they are scanned separately: the
// org avatar upload is an action because it carries a blob.
const ADMIN_ACTION_FILES = ["accounts/organization.ts"]

const ADMIN_WRAPPED =
  /^export\s+const\s+(\w+)\s*=\s*(?:adminMutation|adminQuery)\s*\(/gm
const ADMIN_ACTION_GATE = /requireOrgAdminAction\s*\(\s*ctx\b/g

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

describe("the admin surface", () => {
  it("is exactly the org administration and audit-log functions", () => {
    const found: Record<string, string[]> = {}
    for (const file of files) {
      const names = [
        ...readFileSync(file, "utf8").matchAll(ADMIN_WRAPPED),
      ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]))
      if (names.length > 0) found[relative(file)] = names
    }
    expect(found).toEqual(ADMIN_SURFACE)
  })

  it("gates no action outside that same list", () => {
    const found = files.filter(
      (file) =>
        // The wrapper's own definition names its ctx parameter the same way a
        // call site does, so the file that DEFINES the gate is excluded here
        // for the reason the known-positive test states below.
        relative(file) !== "lib/functions.ts" &&
        [...readFileSync(file, "utf8").matchAll(ADMIN_ACTION_GATE)].length > 0
    )
    expect(found.map(relative).sort()).toEqual([...ADMIN_ACTION_FILES].sort())
  })

  // The scanner is only worth having if it can see a gate. lib/functions.ts
  // DEFINES both wrappers and gates nothing, which is why it is absent from the
  // allowlist: a definition is not a call site, and a scanner that could not
  // tell them apart would either fail here forever or match nothing at all.
  it("can tell a definition from a gated export", () => {
    const wrappers = readFileSync(join(BACKEND, "lib/functions.ts"), "utf8")
    expect(wrappers).toContain("export const adminMutation")
    expect([...wrappers.matchAll(ADMIN_WRAPPED)]).toEqual([])
    const gated = readFileSync(join(BACKEND, "accounts/audit.ts"), "utf8")
    expect(
      [...gated.matchAll(ADMIN_WRAPPED)].map((match) => match[1])
    ).toContain("getAuditLogPage")
  })
})
