// The app's warning tone, as one pair of class strings instead of the same
// literal copied into every surface that has something amber to say. The design
// system has no warning variant (Alert ships default and destructive only), so
// the tint is a call-site override everywhere; that is exactly why it needs a
// single definition, or the six surfaces that carry a warning drift into six
// slightly different ambers.
//
// Two constants rather than one because the two uses are different: a bordered
// block (an Alert, an outline Badge) tints its border AND its text, while a
// warning that sits inside other text (a checklist row's icon, a marker beside a
// figure) tints only the text.
export const WARNING_TEXT_CLASS = "text-amber-700 dark:text-amber-400"

export const WARNING_ALERT_CLASS = `border-amber-500/50 ${WARNING_TEXT_CLASS}`
