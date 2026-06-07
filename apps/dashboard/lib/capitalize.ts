// Capitalizes the first character of a display string. Used for onboarding
// headings that may start with an interpolated organization name: the name
// renders as typed everywhere else, but a heading-initial letter follows
// heading typography ("acme's model" reads as "Acme's model"). Idempotent on
// headings that already start with a capital or a non-letter.
export function capitalizeFirst(text: string, locale: string): string {
  const first = text.codePointAt(0)
  if (first === undefined) return text
  const head = String.fromCodePoint(first)
  return head.toLocaleUpperCase(locale) + text.slice(head.length)
}
