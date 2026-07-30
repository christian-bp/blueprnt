import { describe, expect, it } from "vitest"
import { internal } from "./_generated/api"
import { AUDIT_EVENTS, logAudit } from "./lib/audit"
import { locateAuditPage } from "./lib/auditAggregates"
import { initConvexTest } from "./testing.helpers"

// The dev reset and the aggregate backfill are the only repair mechanisms if
// the pager's count/offset aggregates ever diverge from the auditLog table,
// so both get a smoke test: a wipe must leave no phantom aggregate state, and
// the backfill must register pre-aggregate rows exactly once.

const ORG = "org-devreset"
const ACTOR = "actor-devreset"

async function seedRowsThroughLogAudit(
  t: ReturnType<typeof initConvexTest>,
  count: number
) {
  await t.run(async (ctx) => {
    for (let i = 0; i < count; i++) {
      await logAudit(ctx, {
        orgId: ORG,
        type: AUDIT_EVENTS.roleCreated,
        actorId: ACTOR,
        payload: { roleId: `role-${i}`, changes: {} },
      })
    }
  })
}

async function aggregateTotal(t: ReturnType<typeof initConvexTest>) {
  return await t.run(async (ctx) => {
    const { total } = await locateAuditPage(ctx, {
      orgId: ORG,
      category: null,
      start: undefined,
      end: undefined,
      offset: 0,
    })
    return total
  })
}

describe("devReset.wipeAppTables", () => {
  it("clears the audit aggregates along with the rows", async () => {
    const t = initConvexTest()
    await seedRowsThroughLogAudit(t, 3)
    expect(await aggregateTotal(t)).toBe(3)

    let done = false
    while (!done) {
      const result = await t.mutation(internal.devReset.wipeAppTables, {})
      done = result.done
    }

    await t.run(async (ctx) => {
      expect(
        await ctx.db
          .query("auditLog")
          .withIndex("by_org", (q) => q.eq("orgId", ORG))
          .collect()
      ).toHaveLength(0)
    })
    expect(await aggregateTotal(t)).toBe(0)
  })
})

describe("devReset.backfillAuditLogAggregates", () => {
  it("registers pre-aggregate rows and stays idempotent on a re-run", async () => {
    const t = initConvexTest()
    // Rows inserted DIRECTLY (as rows written before the aggregates shipped
    // were): invisible to the aggregates until backfilled.
    await t.run(async (ctx) => {
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("auditLog", {
          orgId: ORG,
          type: "role.created",
          actorId: ACTOR,
          actorName: "Admin Person",
          payload: { roleId: `legacy-${i}`, changes: {} },
          category: "role",
        })
      }
    })
    expect(await aggregateTotal(t)).toBe(0)

    let cursor: string | undefined
    let done = false
    while (!done) {
      const result = await t.mutation(
        internal.devReset.backfillAuditLogAggregates,
        cursor === undefined ? {} : { cursor }
      )
      done = result.done
      cursor = result.continueCursor
    }
    expect(await aggregateTotal(t)).toBe(3)

    // Idempotent: a second full pass changes nothing.
    let cursor2: string | undefined
    let done2 = false
    while (!done2) {
      const result = await t.mutation(
        internal.devReset.backfillAuditLogAggregates,
        cursor2 === undefined ? {} : { cursor: cursor2 }
      )
      done2 = result.done
      cursor2 = result.continueCursor
    }
    expect(await aggregateTotal(t)).toBe(3)
  })
})
