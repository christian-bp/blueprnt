// The most assignment writes one mutation may carry (the classify surface's
// per-group and bulk confirms chunk to this bound). Each assignment costs
// roughly 8-12 document writes (close + insert + audit row + aggregate
// upkeep), so the bound keeps a chunk far under Convex's per-transaction
// limits while staying large enough that a typical title group fits in one.
export const MAX_ASSIGNMENTS_PER_MUTATION = 50
