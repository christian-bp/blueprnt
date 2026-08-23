// One user gesture, one id.
//
// Most acts are one mutation and need nothing: their single audit row already
// IS the story. A handful are one press that fires several mutations (the
// compliance dialog's up-to-three calls, a chunked bulk confirm), and those
// wrote a scatter of unrelated-looking rows into the audit log. They mint one
// id here and pass it as `gestureId` to every mutation in the gesture; the
// backend stamps every row the gesture writes, and the log renders them as one
// story.
//
// The id is MINTED ON THE CLIENT deliberately: a server-generated id could
// only ever span one transaction, which is the opposite of what this is for.
// It is opaque and carries no meaning, no PII, and no ordering. The backend
// accepts only this exact shape (normalizeGestureId in convex/lib/audit.ts),
// which is what makes the schema's no-PII claim a constraint rather than a
// comment. Distinct from the `batchId` some audit payloads carry: that one is
// server-minted per starter-seed run and is shown to the reader.
export function newGestureId(): string {
  return crypto.randomUUID()
}
