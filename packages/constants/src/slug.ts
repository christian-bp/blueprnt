// Canonical slug rule, shared by the client (Zod form gate) and the server
// (Convex re-validation) so one definition governs both. A slug is lowercase
// letters/digits in hyphen-separated groups, no leading/trailing/double hyphen.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug)
}

const TRANSLITERATE: Record<string, string> = {
  ø: "o",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  ð: "d",
  þ: "th",
  ł: "l",
  đ: "d",
}

// Lowercase, transliterate the Nordic/Latin letters that do not decompose under
// NFD (o with stroke, ae, ...), strip remaining combining marks (a-umlaut->a,
// o-umlaut->o, a-ring->a, e-acute->e), then collapse any run of non [a-z0-9]
// into a single hyphen and trim hyphens.
// Produces a string that satisfies SLUG_PATTERN (or "" for empty input).
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[øæœßðþłđ]/g, (c) => TRANSLITERATE[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
