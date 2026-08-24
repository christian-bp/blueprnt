// One gesture reads as one story.
//
// A handful of user gestures fire several mutations (the compliance dialog's
// reopen/save/sign-off sequence, a chunked bulk classify confirm). Each write
// is its own audit row, correctly: the trail records what actually happened.
// What was wrong was the READING, where one press scattered rows that looked
// unrelated. The mutations of one gesture share a client-minted `gestureId`
// (lib/gesture.ts), and this groups them back together for display.
//
// Grouping is a RENDER concern over the page already fetched, never a query:
// consecutive rows sharing a gestureId are one story. Consequences, both
// deliberate:
//
//   - A gesture LARGER THAN A PAGE spans pages by design, and each page shows
//     the part it holds. This is not an edge case at our scale: a bulk classify
//     confirm writes one row PER PERSON, so a 400-person confirm fills sixteen
//     consecutive pages, each rendering a full-page part. Every part is
//     internally honest (it counts exactly the rows it holds) and sixteen
//     labelled parts still read better than four hundred loose rows, but a
//     reader paging through them is seeing one act, not sixteen. Joining across
//     a page the client has not fetched is what this deliberately does not do;
//     making a large gesture read as one line everywhere would take a real
//     per-gesture summary event, not a smarter fold.
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
  gestureId?: string
}

export interface AuditStory<Row extends StoryRow> {
  // Stable across renders: the first row's id, which no other story can hold.
  // Deliberately not the lead's id, which moves as rows join.
  key: string
  // The gesture every row in this story belongs to, held on the story itself so
  // the join predicate compares against something that never moves. Absent for
  // an ordinary ungrouped row.
  gestureId?: string
  // The row whose event names the story, and whose actor/time/category the
  // summary shows. See leadIndex below for which one that is.
  lead: Row
  // Every row in the story, in the page's own order, lead included. Length 1
  // for an ordinary ungrouped row.
  rows: Row[]
  // True when every row carries the SAME event type, which is what a bulk
  // gesture looks like: assignPeopleToRole writes one `assignment.set` per
  // person, so a 25-person confirm is 25 rows of one type. There is no most
  // specific row to lead with, and the caller must NOT render the lead's own
  // per-row detail as the story's face: that detail names one employee and
  // their role change, so a summary built from it reads as a claim about that
  // person on behalf of twenty-four others. Such a story is headlined by its
  // event and its count and nothing else.
  uniform: boolean
}

// Which of a story's rows names it: the gesture's most SPECIFIC event, meaning
// the least repeated one. A gesture that writes several rows of one type plus
// one row that concludes it is led by the conclusion, not by the last of the
// repeated rows (adding a person writes one `person.created` and one
// `assignment.set`; a criterion correction writes its reopen, its write and its
// sign-off, all distinct). Ties go to the FIRST row, which under newest-first
// ordering is the gesture's last write, the one that finished it.
//
// When EVERY row shares one type the tie is total and this returns 0, which is
// correct as far as it goes but says nothing: `uniform` is what tells the
// caller that the lead is just a row, not a headline.
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

function isUniform<Row extends StoryRow>(rows: Row[]): boolean {
  const first = rows[0]
  if (first === undefined) return true
  return rows.every((row) => row.type === first.type)
}

// Folds a page of rows into stories: CONSECUTIVE rows sharing a gestureId become
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
    // Compared against the STORY's own id, never against the lead's.
    //
    // The two are EQUAL by construction, and deliberately so: every row in a
    // story shares the gesture id that let it join, so whichever row leadIndex
    // picks carries the same id the story was opened with. Reading it off the
    // story is therefore not a behaviour choice and no test can distinguish
    // the two; it is the choice that keeps the equality something leadIndex
    // cannot quietly break, since the lead is reassigned every time a row
    // joins. Said plainly here because the comment used to claim this was a
    // live invariant, which sent a reviewer looking for the test that pins it.
    const joins =
      grouped &&
      previous !== undefined &&
      row.gestureId !== undefined &&
      previous.gestureId === row.gestureId
    if (joins && previous !== undefined) {
      previous.rows.push(row)
      const lead = previous.rows[leadIndex(previous.rows)]
      if (lead !== undefined) previous.lead = lead
      previous.uniform = isUniform(previous.rows)
      continue
    }
    stories.push({
      key: row.id,
      ...(row.gestureId !== undefined ? { gestureId: row.gestureId } : {}),
      lead: row,
      rows: [row],
      uniform: true,
    })
  }
  return stories
}
