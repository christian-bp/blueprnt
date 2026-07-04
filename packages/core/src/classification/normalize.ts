// Pure title normalizer for deterministic matching. No I/O, no clock.
// Steps, in order:
//   1. Transliterate Nordic/Latin letters that do not decompose under NFD
//      (o-stroke, ae-ligature, etc.) to their closest ASCII equivalents.
//   2. Unicode canonical decomposition (NFD) so accented characters split into
//      a base letter + a combining mark.
//   3. Drop the combining marks (Unicode range U+0300..U+036F).
//   4. Lowercase.
//   5. Replace any run of non-alphanumeric characters with a single space.
//   6. Trim leading/trailing whitespace.
// The result contains only lowercase [a-z0-9] words separated by single spaces.

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

export function normalizeTitleString(s: string): string {
  return (
    s
      .replace(/[øæœßðþłđ]/gi, (c) => TRANSLITERATE[c.toLowerCase()] ?? c)
      .normalize("NFD")
      // Combining diacritical marks block U+0300..U+036F. Written as \u escapes so
      // the pattern is unambiguous and copy-safe (no invisible combining chars).
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  )
}
