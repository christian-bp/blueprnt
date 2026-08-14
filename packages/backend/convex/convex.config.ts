import aggregate from "@convex-dev/aggregate/convex.config"
import rag from "@convex-dev/rag/convex.config"
import sweego from "@christian-ek/sweego/convex.config"
import { defineApp } from "convex/server"
import betterAuth from "./betterAuth/convex.config"

const app = defineApp()
app.use(betterAuth)
app.use(sweego)
// Semantic search over the documentation corpus (ADR-0020). Pinned to an
// exact alpha because it is the only build whose peer range accepts the AI
// SDK 7 the assistant is written against; the stable line still requires 6.
app.use(rag)
// Two audit-log count/offset aggregates, one per display ordering: the whole
// org's trail in time order, and each category's trail in time order. Both
// are maintained by logAudit (the single audit writer) and power the audit
// pager's exact page count and jump-to-page (lib/auditAggregates.ts).
app.use(aggregate, { name: "auditAggregateByOrg" })
app.use(aggregate, { name: "auditAggregateByCategory" })

export default app
