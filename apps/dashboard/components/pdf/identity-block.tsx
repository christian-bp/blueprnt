import { Text } from "@react-pdf/renderer"
import { Cover } from "./branded-document"
import { tableStyles } from "./pdf-table"

// The identity block both pay-mapping documents open with (ADR-0030): the
// organization, the run, the reference date, the data extraction instant,
// the method version, the status tag and the generation timestamp. Every
// line arrives resolved (the kit is i18n-free); the block only lays them
// out on the Cover. The detail appendix adds its classification line.
export interface IdentityLabels {
  docTitle: string
  organizationName: string
  runLabel: string
  referenceDateLine: string
  extractedAtLine: string
  methodVersionLine: string
  generatedOn: string
  statusTag: string
}

export function IdentityBlock({
  labels,
  classification,
}: {
  labels: IdentityLabels
  classification?: string
}) {
  return (
    <>
      <Cover
        docTitle={labels.docTitle}
        metaLines={[
          labels.organizationName,
          labels.runLabel,
          labels.referenceDateLine,
          labels.extractedAtLine,
          labels.methodVersionLine,
          labels.generatedOn,
        ]}
        statusTag={labels.statusTag}
      />
      {classification !== undefined && (
        <Text style={tableStyles.para}>{classification}</Text>
      )}
    </>
  )
}
