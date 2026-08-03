// ConvexError codes are serialized into the error message, so a rejected
// mutation is told apart by matching the code the backend threw. One matcher
// for every such predicate, because the "code inside the message" contract is
// the fragile part and must not be restated per call site.
function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && error.message.includes(code)
}

// Distinguishes the duplicate-name rejection (errors.roleFamilyExists) from
// transient failures so the UI never misreports a network error as a
// duplicate name.
export function isDuplicateFamilyError(error: unknown): boolean {
  return hasErrorCode(error, "errors.roleFamilyExists")
}

// The whole-payload rejection: something in the submitted list is out of
// bounds (too many rows, an overlong name or title). Worth its own branch
// because the fix is to edit the list, not to retry it unchanged.
export function isInvalidInputError(error: unknown): boolean {
  return hasErrorCode(error, "errors.invalidInput")
}
