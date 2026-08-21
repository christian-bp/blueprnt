// Joining a list of names by the LOCALE's own rules rather than by a comma we
// picked, because a criterion or dimension name can itself contain the word
// "and". Shared rather than local to the surface that needed it first: the
// library picker names the criteria a candidate overlaps, and the approval
// checklist's remedy lines name overlapping pairs, uncovered dimensions and
// over-cap dimensions the same way.
//
// Constructing an Intl formatter is the expensive part of using one, and these
// call sites are whole lists of rows re-rendering together. One formatter per
// locale and type, reused.
const listFormatters = new Map<string, Intl.ListFormat>()

// "conjunction" reads "A and B" and is right for items that belong together (an
// overlapping pair, the dimensions a check names). "unit" asks for the
// locale's plain separator with no connective, which is what a list whose OWN
// items already contain "and" needs: a list of overlapping pairs, each pair
// itself formatted as "X / Y".
//
// That request is only fully honored where the locale's own CLDR data
// defines a unit list pattern distinct from its conjunction one. Verified
// against this app's five locales (Intl.ListFormat, `style: "long"`): en and
// sv do carry a distinct unit pattern (a bare ", " with no "and"/"och"), but
// nb, da and fi do not -- their "unit" silently falls back to the SAME
// pattern as "conjunction" ("og"/"ja" between items), byte for byte. This is
// accepted rather than worked around: there is no third Intl.ListFormat type
// that does better, and the per-pair "X / Y" format still marks each pair's
// own boundary visually, so "X / Y ja A / B" stays parseable by the "/"
// landmarks even where "ja" also appears inside a name. A hand-rolled joiner
// bypassing Intl.ListFormat for just these three locales was considered and
// rejected: it would fix a cosmetic gap (one connective word) at the cost of
// a second, unaudited pluralization path, for a page that already tells the
// reader which pair and which chapter regardless of how the list is spliced.
export type NameListType = "conjunction" | "unit"

export function formatNames(
  locale: string,
  names: readonly string[],
  type: NameListType = "conjunction"
): string {
  const cacheKey = `${locale}:${type}`
  let formatter = listFormatters.get(cacheKey)
  if (formatter === undefined) {
    // "long", not "short": short renders the English conjunction as "&", which
    // reads as part of a name when the names themselves are phrases ("Effort
    // and complexity & Responsibility and impact"). Every list this formats is
    // a list of criterion or dimension names, so the spelled-out connective is
    // the readable one.
    formatter = new Intl.ListFormat(locale, { style: "long", type })
    listFormatters.set(cacheKey, formatter)
  }
  return formatter.format(names)
}
