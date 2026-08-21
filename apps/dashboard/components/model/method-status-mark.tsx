import { cn } from "@workspace/ui/lib/utils"

// The four states a criterion's documentation moves through, as the Metod
// chapter's wire reports them (evaluationModel/method.ts complianceStatus).
export type ComplianceStatus =
  | "notStarted"
  | "inProgress"
  | "documented"
  | "approved"

// Whether a criterion's documentation is COMPLETE, which is the one question
// this card's footer asks twice: complete states wear a word and offer to
// change what is written, incomplete states wear nothing and offer to write
// it. A total Record, so a fifth status could not compile without an answer.
//
// inProgress counts as incomplete deliberately: some fields filled is not a
// state to congratulate, and a word there would say the criterion is done when
// the approval gate still counts it as outstanding. What acknowledges the
// started work is the ACTION, which stays "document" because that is exactly
// what is left to do.
const DOCUMENTATION_COMPLETE: Record<ComplianceStatus, boolean> = {
  notStarted: false,
  inProgress: false,
  documented: true,
  approved: true,
}

// The two states that HAVE a word. Narrowing to them rather than taking any
// status and returning null keeps the surface honest in the type system: there
// is no status word for "not started" in the message files either, and a
// component that accepted the state would have to invent one.
export type CompleteStatus = Extract<
  ComplianceStatus,
  "documented" | "approved"
>

export function isDocumentationComplete(
  status: ComplianceStatus
): status is CompleteStatus {
  return DOCUMENTATION_COMPLETE[status]
}

// A criterion's documentation status on the Metod card: the word, and nothing
// else.
//
// No pill and no mark. The status used to be an outline Badge, which read as a
// chip the reader could act on and put a bordered box on every card in a
// four-column grid; an icon in its place read as decoration at this size. The
// word carries the state, and the INK carries the distinction between the two
// complete ones: muted for documentation that is written, the success green
// for documentation a human has signed off. Absence carries the unstarted
// state: a card with nothing to say about its documentation says nothing, and
// the empty footer beside its action is the reading.
export function MethodStatusMark({
  status,
  label,
}: {
  status: CompleteStatus
  // The status word, passed in so this stays i18n-namespace agnostic.
  label: string
}) {
  return (
    <span
      className={cn(
        "truncate text-sm",
        status === "approved" ? "text-success" : "text-muted-foreground"
      )}
    >
      {label}
    </span>
  )
}
