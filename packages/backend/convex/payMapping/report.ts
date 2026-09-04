import { v } from "convex/values"
import { AUDIT_EVENTS } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation } from "../lib/functions"

// The key-figures export (the Excel workbook) crosses the export boundary
// (ADR-0011 p.3) under the same rule as the two documents: logged before the
// file is handed over, its own event so the trail says WHICH document left.
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

// The archive package (ADR-0011 p.4: the signing report, the detail appendix,
// the key-figures workbook and manifest.json in one ZIP) crosses the
// boundary as ONE handling: one event for the package, logged before the
// file is handed over, never one per inner file.
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

// The export boundary's log (ADR-0011 p.3): a document export is recorded
// in the audit trail at the moment the document leaves the system. The
// client calls this BEFORE handing the generated PDF to the browser, so a
// download without a trail row cannot happen; the row is this mutation's
// only write. Both a draft (active run) and a final (completed run) export
// are loggable: the statutory duty is on the boundary, not on the document's
// maturity.
export const logPayMappingSigningReportExport = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    // Org isolation: a run id from another tenant reads as absent.
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingSigningReportExported,
      payload: { runId },
    })
    return null
  },
})

// The detail appendix is unmasked (every group, every amount) and available
// to every organization member (ADR-0030): this row is the control. Same
// rule, its own event kind.
export const logPayMappingDetailAppendixExport = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingDetailAppendixExported,
      payload: { runId },
    })
    return null
  },
})
