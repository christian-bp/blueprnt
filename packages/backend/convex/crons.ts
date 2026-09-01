import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

// Sweego owns email delivery + retention; this prunes its history daily.
crons.interval(
  "prune Sweego email history",
  { hours: 24 },
  internal.email.cleanup.run,
  {}
)

// Archived assistant threads age out RETENTION_DAYS after their last
// activity (ADR-0018, owner decision 2026-09-01); the sweep is bounded and
// self-rescheduling, so the daily tick only has to start it.
crons.interval(
  "prune archived assistant threads",
  { hours: 24 },
  internal.assistant.erase.pruneArchivedThreads,
  {}
)

export default crons
