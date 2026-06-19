// Canonical slug rule, shared by the client (Zod form gate) and the server
// (Convex re-validation) so one definition governs both. A slug is lowercase
// letters/digits in hyphen-separated groups, no leading/trailing/double hyphen.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug)
}
