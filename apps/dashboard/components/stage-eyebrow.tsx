// The two stages of the method, named on their own surfaces.
//
// The masterdokument (§4.2.2) separates building the method from assessing a
// role against it, and asks each surface to say which one the reader is in.
// The spec's deviation 10 keeps the pedagogy and drops the form: no blocking
// mode and no standing explainer sentence, just a label the eye passes over on
// the way to the title.
//
// A SCANNED label, not a sentence: uppercase, text-xs, tracked, which is the
// reading floor's own eyebrow exception and the class string this app already
// uses for its scanned section labels (the approval checklist's group titles).
// Shared so the two stages cannot drift into two treatments, and so a third
// stage would join them rather than invent a third.
export const STAGE_EYEBROW_CLASS =
  "shrink-0 whitespace-nowrap font-semibold text-muted-foreground text-xs uppercase tracking-wide"

export function StageEyebrow({ label }: { label: string }) {
  // aria-hidden: the label names the surface, and the surface's own title (the
  // heading or the breadcrumb's last segment) already says what the page is.
  // Announced it would prefix every title with a word that is chrome, not
  // content; a screen-reader user gets the stage from the trail they walked.
  return (
    <span
      aria-hidden="true"
      className={STAGE_EYEBROW_CLASS}
      data-slot="stage-eyebrow"
    >
      {label}
    </span>
  )
}
