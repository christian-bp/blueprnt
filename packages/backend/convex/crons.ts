import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000

crons.interval(
  "cleanup old outbox emails",
  { hours: 24 },
  internal.email.outbox.cleanupOldEmails,
  { olderThanMs: THIRTY_DAYS_MS }
)

crons.interval(
  "sweep stale outbox emails",
  { minutes: 15 },
  internal.email.outbox.sweepStaleEmails,
  { olderThanMs: FIFTEEN_MINUTES_MS }
)

export default crons
