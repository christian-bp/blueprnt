// Live count of confirmed-classified people over the total. "Classified" means
// a confirmed open assignment; suggested-but-unconfirmed does not count (badge,
// not gate). Derived at render, never stored (ADR-0002).
export function countClassified(
  people: {
    currentAssignment: { senioritySource: "suggested" | "confirmed" } | null
  }[]
): { classified: number; total: number } {
  const classified = people.filter(
    (p) => p.currentAssignment?.senioritySource === "confirmed"
  ).length
  return { classified, total: people.length }
}

// The three-way split behind the people sidebar's classification block, in
// the classify surface's own state vocabulary (classify.state.*): pending is
// a suggested-but-unconfirmed assignment, exactly the badge the register
// shows. Derived at render, never stored (ADR-0002).
export function classificationBreakdown(
  people: {
    currentAssignment: { senioritySource: "suggested" | "confirmed" } | null
  }[]
): { confirmed: number; pending: number; unclassified: number; total: number } {
  let confirmed = 0
  let pending = 0
  let unclassified = 0
  for (const person of people) {
    if (person.currentAssignment === null) unclassified += 1
    else if (person.currentAssignment.senioritySource === "confirmed")
      confirmed += 1
    else pending += 1
  }
  return { confirmed, pending, unclassified, total: people.length }
}
