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

// The key-figures export (the Excel workbook) crosses the same boundary
// under the same rule: logged before the file is handed over, its own event
// so the trail says WHICH document left.
export const logPayMappingMetricsExport = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingMetricsExported,
      payload: { runId },
    })
    return null
  },
})

// The archive package (ADR-0011 p.4: the statutory PDF, the key-figures
// workbook and the frozen data.json in one ZIP) crosses the boundary as ONE
// handling: one event for the package, logged before the file is handed
// over, never one per inner file.
export const logPayMappingArchiveExport = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingArchiveExported,
      payload: { runId },
    })
    return null
  },
})

// The union report (the masked samverkan variant, DL 3 kap. 11-12 §§)
// crosses the same boundary under the same rule, with its own event kind so
// the trail says which document was handed over.
export const logPayMappingUnionReportExport = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingUnionReportExported,
      payload: { runId },
    })
    return null
  },
})
