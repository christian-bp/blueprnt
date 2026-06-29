// Distinguishes the duplicate-title rejection (errors.roleExists) from
// transient failures so the UI never misreports a network error as a duplicate
// name. ConvexError codes are serialized into the error message. "roleExists"
// is not a substring of "roleFamilyExists", so the two never cross-match.
export function isDuplicateRoleError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("errors.roleExists")
}
