import { EMAIL_TEMPLATE_KEYS } from "@workspace/constants"
import { v } from "convex/values"

// The single Convex validator for blueprnt's transactional template keys,
// derived from the shared EMAIL_TEMPLATE_KEYS tuple so the send path
// (email/outbox) and the admin log (platform/emailLog) cannot drift. Adding a
// template is one edit in @workspace/constants.
export const vTemplateKey = v.union(
  ...EMAIL_TEMPLATE_KEYS.map((key) => v.literal(key))
)
