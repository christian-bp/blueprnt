import { v } from "convex/values"
import { AUDIT_EVENTS } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation } from "../lib/functions"

// The export boundary's log (ADR-0011 p.3): a kartläggning export is recorded
// in the audit trail at the moment the document leaves the system. The client
// calls this BEFORE handing the generated PDF to the browser, so a download
// without a trail row cannot happen; the row is this mutation's only write.
// Both a draft (active run) and a final (completed run) export are loggable:
// the statutory duty is on the boundary, not on the document's maturity.
export const logPayMappingReportExport = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    // Org isolation: a run id from another tenant reads as absent.
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingReportExported,
      payload: { runId },
    })
    return null
  },
})
