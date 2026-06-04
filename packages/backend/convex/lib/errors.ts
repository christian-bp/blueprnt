import { ConvexError } from "convex/values"

// Machine-readable codes. The backend NEVER returns display text; the
// frontend maps these codes to i18n messages (errors.* keys live in the
// packages/i18n message files).
export const ERROR_CODES = {
  notAuthenticated: "errors.notAuthenticated",
  notAMember: "errors.notAMember",
  adminRequired: "errors.adminRequired",
  membershipConflict: "errors.membershipConflict",
  notFound: "errors.notFound",
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export function appError(code: ErrorCode): ConvexError<{ code: ErrorCode }> {
  return new ConvexError({ code })
}
