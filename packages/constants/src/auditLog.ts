// Rows per page in the audit log. Shared between the Convex page query
// (which slices by it) and the dashboard's pager + loading skeleton (which
// render by it), so the three can never drift apart.
export const AUDIT_LOG_PAGE_SIZE = 25
