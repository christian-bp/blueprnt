import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

crons.interval(
  "cleanup old outbox emails",
  { hours: 24 },
  internal.email.outbox.cleanupOldEmails,
  { olderThanMs: THIRTY_DAYS_MS }
)

export default crons
