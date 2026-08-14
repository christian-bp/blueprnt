import { slugify } from "@workspace/constants"

// The single anchor rule: renderer, chunker, and the link guard all call
// this. Docs headings are plain text by convention (guarded by guard 9 in
// docs-guards.test.ts, which fails on any heading with inline markdown), so
// plain string slugification is the whole rule.
export function headingAnchor(text: string): string {
  return slugify(text)
}
