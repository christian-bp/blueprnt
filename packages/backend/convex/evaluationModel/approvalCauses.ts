import { AUDIT_EVENTS } from "../lib/audit"

// Every event that can take a model's approval away, as ONE list.
//
// It is the type of reopenApprovalIfSet's `cause` parameter (approval.ts), so
// a new call site passing an unlisted event does not compile, and the
// dashboard's coded-value domain (lib/audit-constants.ts) and its drift guard
// both read THIS rather than mirroring it. The cause used to live in three
// hand-synced copies; two of them drifted together when the seventh cause
// arrived, which is a guard comparing two equally-stale lists and passing while
// the log printed a raw code.
//
// It lives in a module of its own, not beside the helper that consumes it,
// because the dashboard imports it AT RUNTIME to build that domain: importing
// a value out of approval.ts pulled the whole mutation module (and everything
// it imports) into the browser bundle, which Convex warns about today and
// throws on in later versions. The rule this module exists to satisfy: the
// dashboard may share backend CONTENT and CONSTANTS, only ever from modules
// that register no Convex functions. lib/backend-imports.test.ts enforces it.
export const APPROVAL_REOPEN_CAUSES = [
  AUDIT_EVENTS.criterionActivated,
  AUDIT_EVENTS.criterionDeactivated,
  AUDIT_EVENTS.criterionReopened,
  AUDIT_EVENTS.modelUpdated,
  AUDIT_EVENTS.modelWorkingConditionsDecided,
] as const

export type ApprovalReopenCause = (typeof APPROVAL_REOPEN_CAUSES)[number]
