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

export default crons
