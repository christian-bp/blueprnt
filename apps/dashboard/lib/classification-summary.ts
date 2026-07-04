// Live count of confirmed-classified people over the total. "Classified" means
// a confirmed open assignment; suggested-but-unconfirmed does not count (badge,
// not gate). Derived at render, never stored (ADR-0002).
export function countClassified(
  people: {
    currentAssignment: { levelSource: "suggested" | "confirmed" } | null
  }[]
): { classified: number; total: number } {
  const classified = people.filter(
    (p) => p.currentAssignment?.levelSource === "confirmed"
  ).length
  return { classified, total: people.length }
}
