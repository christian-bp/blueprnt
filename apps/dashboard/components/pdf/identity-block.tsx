import { CoverPage } from "./cover-page"

// The identity every document in the kit opens with (ADR-0030): the
// organization, the reference date, the data extraction instant, when the
// method was last settled, the status and the generation timestamp. Every
// line arrives resolved (the kit is i18n-free); this only decides where each
// one goes on the cover.
//
// They sit on two levels. The four a reader identifies the document by at
// arm's length -- its name, the organization, the year and, when it is one,
// the fact that it is a draft -- are the cover's type. The rest is a
// colophon: a key/value list set small at the sheet's foot under a rule,
// where it identifies the version without competing with the title.
//
// The run's own NAME is on neither. It is free text an organization types
// ("Lonekartlaggning 2027"), so it says nothing the cover's title and year
// do not already say, and printing it made the sheet name the same thing
// twice.
export interface IdentityLabels {
  // The sheet's one large line: the SUBJECT of the document ("Pay mapping"),
  // not its kind. Which of the two pay-mapping documents this is belongs on
  // the foot label, where the design puts the word naming the artefact.
  coverTitle: string
  organizationName: string
  // The band's top-right label: the year the document covers. Absent on a
  // document that covers no period (the method appendix).
  year?: string
  // Present only while the document is a draft; it joins the year in the same
  // label, because a reader who misses this circulates provisional figures.
  draftMarker?: string
  // The small label at the sheet's foot, naming the kind of document.
  footLabel: string
  referenceDateLine: string
  extractedAtLine: string
  // WHEN the method was last settled, not what it is called. A method is a
  // model of criteria and weights; it has no name a reader could check, and
  // printing an internal engine version invited exactly that reading. The
  // date is the fact that matters: it says which method the figures were
  // computed under.
  methodUpdatedLine: string
  generatedOn: string
  // The one line a draft owes its reader: the band's marker says the state,
  // this says what the state means for the figures.
  statusNote?: string
  // The label column, one per colophon line. Resolved like everything else
  // the kit prints.
  factLabels: {
    referenceDate: string
    extractedAt: string
    methodUpdated: string
    generatedOn: string
  }
}

// The band's label: the year, and the draft marker beside it when there is
// one. Undefined when the document has neither, so the band renders with the
// logo alone rather than with an empty text node.
export function coverMark(
  labels: Pick<IdentityLabels, "year" | "draftMarker">
): string | undefined {
  const parts = [labels.year, labels.draftMarker].filter(
    (part): part is string => part !== undefined
  )
  return parts.length === 0 ? undefined : parts.join("  ·  ")
}

export function IdentityCover({
  labels,
  classification,
}: {
  labels: IdentityLabels
  // The appendix's access line: a condition of reading the document rather
  // than one of its identity facts, so it joins the draft note under the
  // colophon's rule instead of the key/value list above it.
  classification?: string
}) {
  return (
    <CoverPage
      title={labels.coverTitle}
      subtitle={labels.organizationName}
      markLabel={coverMark(labels)}
      facts={[
        {
          label: labels.factLabels.referenceDate,
          value: labels.referenceDateLine,
        },
        { label: labels.factLabels.extractedAt, value: labels.extractedAtLine },
        {
          label: labels.factLabels.methodUpdated,
          value: labels.methodUpdatedLine,
        },
        { label: labels.factLabels.generatedOn, value: labels.generatedOn },
      ]}
      notes={[labels.statusNote, classification].filter(
        (note): note is string => note !== undefined
      )}
      footLabel={labels.footLabel}
    />
  )
}
