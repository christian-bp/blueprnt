import { describe, expect, it } from "vitest"
import { auditStories, type StoryRow } from "@/lib/audit-stories"

function row(id: string, type: string, gestureId?: string): StoryRow {
  return { id, type, ...(gestureId !== undefined ? { gestureId } : {}) }
}

describe("auditStories", () => {
  it("leaves rows without a gesture id as themselves", () => {
    const rows = [row("a", "role.created"), row("b", "model.updated")]
    const stories = auditStories(rows)
    expect(stories).toHaveLength(2)
    expect(stories.every((story) => story.rows.length === 1)).toBe(true)
    expect(stories.map((story) => story.lead.id)).toEqual(["a", "b"])
  })

  it("folds consecutive rows sharing a gesture id into one story", () => {
    const stories = auditStories([
      row("a", "criterion.approved", "g1"),
      row("b", "model.updated", "g1"),
      row("c", "criterion.reopened", "g1"),
      row("d", "role.created"),
    ])
    expect(stories).toHaveLength(2)
    expect(stories[0]?.rows.map((r) => r.id)).toEqual(["a", "b", "c"])
    expect(stories[1]?.rows.map((r) => r.id)).toEqual(["d"])
  })

  // The story's key is the first row's id, so it cannot change as the lead
  // moves and React cannot lose the open/closed state of an expanded story.
  it("keys a story by its first row, whatever leads it", () => {
    const stories = auditStories([
      row("a", "assignment.set", "g1"),
      row("b", "assignment.set", "g1"),
      row("c", "person.created", "g1"),
    ])
    expect(stories[0]?.key).toBe("a")
    expect(stories[0]?.lead.id).toBe("c")
  })

  // The gesture's least repeated event names it. Real pair: add-person writes
  // one person.created and one assignment.set, and the story is about the
  // person being added.
  it("leads with the gesture's most specific event", () => {
    const stories = auditStories([
      row("a", "assignment.set", "g1"),
      row("b", "assignment.set", "g1"),
      row("c", "assignment.set", "g1"),
      row("d", "person.created", "g1"),
    ])
    expect(stories[0]?.lead.type).toBe("person.created")
    expect(stories[0]?.rows).toHaveLength(4)
    expect(stories[0]?.uniform).toBe(false)
  })

  // THE BULK CASE, which is what a classify confirm actually writes:
  // assignPeopleToRole writes one assignment.set PER PERSON, so every row in
  // the story carries the same type and there is no most-specific row to lead
  // with. The fold has to SAY so, because the caller must not render the
  // lead's own per-row detail as the story's face: that detail names one
  // employee and their role change.
  it("marks an all-one-type story as uniform, with no meaningful lead", () => {
    const stories = auditStories(
      Array.from({ length: 25 }, (_, index) =>
        row(`p${index}`, "assignment.set", "g1")
      )
    )
    expect(stories).toHaveLength(1)
    expect(stories[0]?.rows).toHaveLength(25)
    expect(stories[0]?.uniform).toBe(true)
  })

  it("carries the gesture id on the story itself, not only on its rows", () => {
    const stories = auditStories([
      row("a", "assignment.set", "g1"),
      row("b", "person.created", "g1"),
      row("c", "role.created"),
    ])
    expect(stories[0]?.gestureId).toBe("g1")
    expect(stories[1]?.gestureId).toBeUndefined()
  })

  // Every event distinct: the first row wins, which under newest-first
  // ordering is the write that finished the gesture.
  it("leads with the first row when nothing is more specific", () => {
    const stories = auditStories([
      row("a", "criterion.approved", "g1"),
      row("b", "model.updated", "g1"),
    ])
    expect(stories[0]?.lead.id).toBe("a")
  })

  // Consecutive, never "every row with this id": two gestures separated by
  // other writes must not be welded into one story that claims both.
  it("never joins rows that are not adjacent", () => {
    const stories = auditStories([
      row("a", "person.updated", "g1"),
      row("b", "role.created"),
      row("c", "assignment.set", "g1"),
    ])
    expect(stories).toHaveLength(3)
    expect(stories.map((story) => story.rows.length)).toEqual([1, 1, 1])
  })

  it("never joins rows carrying different gesture ids", () => {
    const stories = auditStories([
      row("a", "person.created", "g1"),
      row("b", "assignment.set", "g2"),
    ])
    expect(stories).toHaveLength(2)
  })

  // A gesture split across a page boundary renders as two partial stories.
  // Deliberate: grouping folds the page the client already has, and each part
  // still reads correctly and counts only what it holds.
  it("renders a gesture split across a page boundary as two partial stories", () => {
    const first = auditStories([
      row("x", "role.created"),
      row("a", "assignment.set", "g1"),
      row("b", "assignment.set", "g1"),
    ])
    const second = auditStories([
      row("c", "assignment.set", "g1"),
      row("d", "role.created"),
    ])
    expect(first[1]?.rows).toHaveLength(2)
    expect(second[0]?.rows).toHaveLength(1)
  })

  // Search shows the rows that MATCHED. Folding a hit into a story would hide
  // it inside a collapsed summary, or imply its unmatched siblings matched.
  it("groups nothing when grouping is off", () => {
    const rows = [
      row("a", "criterion.approved", "g1"),
      row("b", "model.updated", "g1"),
    ]
    const stories = auditStories(rows, { grouped: false })
    expect(stories).toHaveLength(2)
    expect(stories.map((story) => story.rows.length)).toEqual([1, 1])
  })

  it("returns nothing for no rows", () => {
    expect(auditStories([])).toEqual([])
  })
})
