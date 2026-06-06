// Distinguishes the duplicate-name rejection (errors.roleFamilyExists) from
// transient failures so the UI never misreports a network error as a
// duplicate name. ConvexError codes are serialized into the error message.
export function isDuplicateFamilyError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("errors.roleFamilyExists")
  )
}
