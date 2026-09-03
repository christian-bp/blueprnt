// Upper bound on the people one archive write may touch: the register's
// bulk action and the payroll import both archive leavers in chunks of this
// size (one transaction per chunk), so a large org's leavers never ride one
// unbounded mutation. Shared here so the client loop and the backend bound
// can never drift apart.
export const PEOPLE_ARCHIVE_CHUNK_SIZE = 50

// Validation ceiling for a full-time-hours-per-month figure (person override
// or organization default). Shared by the Zod form schemas and the Convex
// validators so the two gates can never disagree. A month has ~730 hours; a
// full-time figure past 400 is a typo (a weekly figure, an annual one).
export const FULL_TIME_HOURS_MAX = 400
