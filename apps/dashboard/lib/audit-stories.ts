// One gesture reads as one story.
//
// A handful of user gestures fire several mutations (the compliance dialog's
// reopen/save/sign-off sequence, a chunked bulk classify confirm). Each write
// is its own audit row, correctly: the trail records what actually happened.
// What was wrong was the READING, where one press scattered rows that looked
// unrelated. The mutations of one gesture share a client-minted `batchId`
// (lib/gesture.ts), and this groups them back together for display.
//
// Grouping is a RENDER concern over the page already fetched, never a query.
// The rows of one gesture are written milliseconds apart, so time-ordered
// pagination puts them next to each other; consecutive rows sharing a batchId
// are one story. Consequences, both deliberate:
//
//   - A gesture straddling a PAGE BOUNDARY renders as two partial stories, one
//     at the end of a page and one at the start of the next. Rare (it needs the
//     boundary to fall inside the few milliseconds a gesture takes) and
//     harmless (each part still reads correctly and counts what it holds), and
//     the alternative is joining across a page the client has not fetched.
//   - The pager's totals stay ROW-based: the aggregates count rows, and a
//     three-row story pages as three. Deliberate. The alternative is a
//     story-aware count, which would need the aggregates to know about
//     grouping, would make a page's height depend on its own contents, and
//     would break the O(log n) jump-to-page the aggregates exist to provide.
//     The page shows a fixed number of ROWS, some of which are stories.

// Only what grouping needs. The section's own AuditRow satisfies it.
export interface StoryRow {
  id: string
  type: string
  batchId?: string
}

export interface AuditStory<Row extends StoryRow> {
  // Stable across renders: the lead row's id, which no other story can hold.
  key: string
  // The row whose event names the story, and whose actor/time/category the
  // summary shows. See leadIndex below for which one that is.
  lead: Row
  // Every row in the story, in the page's own order, lead included. Length 1
  // for an ordinary ungrouped row.
  rows: Row[]
}

// Which of a story's rows names it. The gesture's most SPECIFIC event, meaning
// the least repeated one: a bulk confirm of 40 people writes 40 identical
// `assignment.set` rows and one `classification.confirmed`, and the story is
// about the confirmation, not about the fortieth assignment. Ties (every event
// distinct, as in the compliance sequence) go to the FIRST row, which under
// newest-first ordering is the gesture's last write, the one that finished it.
function leadIndex<Row extends StoryRow>(rows: Row[]): number {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.type, (counts.get(row.type) ?? 0) + 1)
  let best = 0
  for (let i = 1; i < rows.length; i++) {
    const current = counts.get(rows[i]?.type ?? "") ?? 0
    const leading = counts.get(rows[best]?.type ?? "") ?? 0
    if (current < leading) best = i
  }
  return best
}

// Folds a page of rows into stories: CONSECUTIVE rows sharing a batchId become
// one, everything else stays itself. Consecutive rather than "all rows with
// this id", so two separate gestures that somehow reused an id (or a batch
// interleaved with another actor's writes) can never be welded into one story
// that claims things it did not do.
//
// `grouped: false` returns every row as its own single-row story, which is
// what SEARCH results take: a search shows the rows that MATCHED, and folding
// a matched row into a story would hide the hit inside a collapsed summary or,
// worse, imply that its unmatched siblings matched too.
export function auditStories<Row extends StoryRow>(
  rows: readonly Row[],
  options?: { grouped?: boolean }
): AuditStory<Row>[] {
  const grouped = options?.grouped ?? true
  const stories: AuditStory<Row>[] = []
  for (const row of rows) {
    const previous = stories[stories.length - 1]
    const joins =
      grouped &&
      previous !== undefined &&
      row.batchId !== undefined &&
      previous.lead.batchId === row.batchId
    if (joins && previous !== undefined) {
      previous.rows.push(row)
      const lead = previous.rows[leadIndex(previous.rows)]
      if (lead !== undefined) previous.lead = lead
      continue
    }
    stories.push({ key: row.id, lead: row, rows: [row] })
  }
  return stories
}
