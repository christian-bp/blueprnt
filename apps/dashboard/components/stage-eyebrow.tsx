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

// Announced, not aria-hidden.
//
// It was hidden at first, on the reasoning that the surface's own title already
// says where you are and the stage is chrome. That reasoning holds on the rate
// route, which renders a breadcrumb in every one of its states, and does NOT
// hold on the model shell, which has no breadcrumb at all: its heading reads
// "Chapters", so hiding the eyebrow left the stage announced to nobody on one
// of the two surfaces this label exists for. Two words before a heading is a
// small cost; the phase's whole point is that the reader knows which stage they
// are in, and a reader using a screen reader needs that as much as anyone.
//
// One behaviour rather than a per-surface prop: two modes of one label is the
// drift this shared component exists to prevent.
export function StageEyebrow({ label }: { label: string }) {
  return (
    <span className={STAGE_EYEBROW_CLASS} data-slot="stage-eyebrow">
      {label}
    </span>
  )
}
