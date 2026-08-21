/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test"
import ragTest from "@convex-dev/rag/test"
import { convexTest } from "convex-test"
import { components } from "./_generated/api"
import authSchema from "./betterAuth/schema"
import schema from "./schema"

// Every t created in a test, so the global afterEach (test.setup.ts) can drain
// their in-flight scheduled functions before the vitest worker tears down.
// convex-test runs runAfter(0) work (e.g. the email deliver action) in the
// background; that work is intentionally NOT wired to Sweego in tests (see
// email/outbox.ts), so it fails and logs asynchronously. If a completion log is
// still in flight at worker teardown, vitest throws an unhandled
// "Closing rpc while onUserConsoleLog was pending" and fails the run even though
// every test passed. Draining flushes those logs inside the test lifecycle.
const liveTests: ReturnType<typeof convexTest>[] = []

// Register the LOCAL betterAuth component with OUR generated schema.
// Do not use @convex-dev/better-auth/test: it registers the package's
// bundled schema, which does not include our org tables/indexes.
export function initConvexTest() {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"))
  t.registerComponent(
    "betterAuth",
    authSchema,
    import.meta.glob("./betterAuth/**/*.ts")
  )
  // The audit pager's count/offset aggregates: logAudit writes into them
  // inline (awaited, unlike Sweego's fire-and-forget email jobs), so every
  // test that runs a state-changing mutation needs them registered.
  aggregateTest.register(t, "auditAggregateByOrg")
  aggregateTest.register(t, "auditAggregateByCategory")
  // The documentation RAG component (docs/rag.ts). Its register also mounts the
  // component's own workpool, which the async delete paths run on.
  ragTest.register(t, "rag")
  liveTests.push(t)
  return t
}

// Grants model approval directly (bypassing the real twelve-check gate,
// approveModel), so rating/scoring-focused test fixtures satisfy setRating's
// FIRST gate (model.approval set, ADR-0023) without having to fully document
// every criterion. Mirrors the direct-DB-write pattern tests already use to
// force approval state (see evaluationModel/criteria.test.ts).
export async function grantModelApproval(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  actorId = "test-approver"
): Promise<void> {
  await t.run(async (ctx) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    if (model === null) throw new Error("grantModelApproval: no model for org")
    await ctx.db.patch(model._id, {
      approval: { approvedBy: actorId, approvedAt: Date.now() },
    })
  })
}

// Attaches a second member to an existing org as an EDITOR and returns their
// identity handle. seedMembership always creates a fresh org of its own, so the
// user it makes is re-attached to the target org with seedDuplicateMember (the
// component has no "add member to this org" seeder).
//
// Shared rather than re-declared per file because the access model needs the
// same identity in every context: a member-level function is only proven by a
// non-admin performing it, and a test that reaches for the admin it already has
// proves the gate is open, not that it is open to the right people.
export async function addEditorMember(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  email: string
) {
  const { userId: editorId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "Editor Person", role: "editor" }
  )
  await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
    orgId,
    userId: editorId,
    role: "editor",
  })
  return { editorId, asEditor: t.withIdentity({ subject: editorId }) }
}

// Settle any background scheduled functions started during the test so their
// success/failure logs complete now instead of racing worker teardown. Their
// failure is expected (Sweego is not registered in tests) and is not a test
// failure, so swallow it: finishInProgressScheduledFunctions already resolves on
// failure, and the try/catch guards any stray rejection.
export async function drainScheduledFunctions() {
  for (const t of liveTests.splice(0)) {
    try {
      await t.finishInProgressScheduledFunctions()
    } catch {
      // Background job failure is logged by convex-test; not a test failure.
    }
  }
}
