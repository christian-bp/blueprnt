import { v } from "convex/values"
import {
  AUDIT_EVENTS,
  buildChanges,
  NOTE_AUDIT_FIELDS,
  resolveActorName,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { actionTargetValidator, payMappingNoteTypeValidator } from "./tables"
import {
  resolveTargetLabel,
  snapshotRowsForRun,
  validateTarget,
} from "./workLayer"

const noteShape = v.object({
  noteId: v.id("payMappingNotes"),
  target: actionTargetValidator,
  text: v.string(),
  noteType: payMappingNoteTypeValidator,
  createdBy: v.string(),
  createdByName: v.string(),
  createdAt: v.number(),
})

// The run's notes, newest first, with author names resolved at read time.
export const listNotes = orgQuery({
  args: { runId: v.id("payMappingRuns") },
  returns: v.array(noteShape),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId) return []
    const notes = await ctx.db
      .query("payMappingNotes")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    notes.sort((a, b) => b.createdAt - a.createdAt)
    const distinctAuthors = [...new Set(notes.map((n) => n.createdBy))]
    const nameById = new Map(
      await Promise.all(
        distinctAuthors.map(
          async (id) => [id, await resolveActorName(ctx, id)] as const
        )
      )
    )
    return notes.map((n) => ({
      noteId: n._id,
      target: n.target,
      text: n.text,
      noteType: n.noteType,
      createdBy: n.createdBy,
      createdByName: nameById.get(n.createdBy) ?? "unknown",
      createdAt: n.createdAt,
    }))
  },
})

export const createNote = orgMutation({
  args: {
    runId: v.id("payMappingRuns"),
    target: actionTargetValidator,
    text: v.string(),
    noteType: payMappingNoteTypeValidator,
  },
  returns: v.id("payMappingNotes"),
  handler: async (ctx, { runId, target, text, noteType }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    // Notes are part of the analysis documentation: fully locked with the
    // run (unlike action STATUS, which stays live for the follow-up years).
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)
    if (text.trim() === "") throw appError(ERROR_CODES.invalidInput)

    const rows = await snapshotRowsForRun(ctx, ctx.orgId, runId)
    // The deep-dive's gender-pure groups take notes (never formal actions),
    // so excluded group keys are valid here.
    const { targetLabel } = validateTarget(rows, target, {
      allowExcludedGroups: true,
    })

    const noteId = await ctx.db.insert("payMappingNotes", {
      orgId: ctx.orgId,
      runId,
      target,
      text: text.trim(),
      noteType,
      createdBy: ctx.authUserId,
      createdAt: Date.now(),
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingNoteCreated,
      payload: {
        runId,
        noteId,
        targetKind: target.kind,
        targetLabel,
        noteType,
      },
    })
    return noteId
  },
})

export const updateNote = orgMutation({
  args: {
    noteId: v.id("payMappingNotes"),
    text: v.string(),
    noteType: payMappingNoteTypeValidator,
  },
  returns: v.null(),
  handler: async (ctx, { noteId, text, noteType }) => {
    const note = await ctx.db.get(noteId)
    if (note === null || note.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    const run = await ctx.db.get(note.runId)
    if (run === null) throw appError(ERROR_CODES.notFound)
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)
    if (text.trim() === "") throw appError(ERROR_CODES.invalidInput)

    const trimmed = text.trim()
    const textChanged = note.text !== trimmed
    await ctx.db.patch(noteId, { text: trimmed, noteType })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingNoteUpdated,
      payload: {
        runId: note.runId,
        noteId,
        targetLabel: resolveTargetLabel(note.target),
        // The classification only; the note text never enters the trail. A
        // text-only edit sets the detailsChanged marker so the row never
        // reads as a no-op (ADR-0015: a changed-marker, never the text).
        changes: {
          ...buildChanges(
            { noteType: note.noteType },
            { noteType },
            NOTE_AUDIT_FIELDS
          ),
          ...(textChanged ? { detailsChanged: { from: null, to: true } } : {}),
        },
      },
    })
    return null
  },
})

export const deleteNote = orgMutation({
  args: { noteId: v.id("payMappingNotes") },
  returns: v.null(),
  handler: async (ctx, { noteId }) => {
    const note = await ctx.db.get(noteId)
    if (note === null || note.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    const run = await ctx.db.get(note.runId)
    if (run === null) throw appError(ERROR_CODES.notFound)
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)
    const targetLabel = resolveTargetLabel(note.target)
    await ctx.db.delete(noteId)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingNoteDeleted,
      payload: {
        runId: note.runId,
        noteId,
        targetKind: note.target.kind,
        targetLabel,
      },
    })
    return null
  },
})
