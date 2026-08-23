// One user gesture, one id.
//
// Most acts are one mutation and need nothing: their single audit row already
// IS the story. A handful are one press that fires several mutations (the
// compliance dialog's up-to-three calls, a chunked bulk confirm), and those
// wrote a scatter of unrelated-looking rows into the audit log. They mint one
// id here and pass it as `batchId` to every mutation in the gesture; the
// backend stamps every row the gesture writes, and the log renders them as one
// story.
//
// The id is MINTED ON THE CLIENT deliberately: a server-generated id could
// only ever span one transaction, which is the opposite of what this is for.
// It is opaque and carries no meaning, no PII, and no ordering.
export function newGestureId(): string {
  return crypto.randomUUID()
}
