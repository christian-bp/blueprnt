import { pdf, Text, View } from "@react-pdf/renderer"
import { describe, expect, it } from "vitest"
import {
  BrandedDocument,
  BrandedPage,
  Section,
} from "@/components/pdf/branded-document"
import { IdentityCover } from "@/components/pdf/identity-block"
import {
  CapturedText,
  computeHeaderBreaks,
  tableStyles as s,
  TocRow,
} from "@/components/pdf/pdf-table"
import { SignatureBlock } from "@/components/pdf/signature-block"

const IDENTITY = {
  factLabels: {
    referenceDate: "Reference date",
    extractedAt: "Data extracted",
    methodUpdated: "Method last updated",
    generatedOn: "Generated",
  },
  coverTitle: "Pay mapping",
  organizationName: "Acme AB",
  runLabel: "Pay mapping 2026",
  referenceDateLine: "1 Jul 2026",
  extractedAtLine: "1 Jul 2026, 09:12",
  methodUpdatedLine: "12 Jun 2026",
  generatedOn: "3 Sep 2026",
  draftMarker: "DRAFT",
  year: "2026",
  footLabel: "Report",
}

describe("pdf primitives (real render)", () => {
  it("renders the identity block, a table with captured rows, a TOC row and the signature block", async () => {
    const rowPages: Record<string, number> = {}
    const blob = await pdf(
      <BrandedDocument>
        <IdentityCover
          labels={IDENTITY}
          classification="Internal document. Every download is logged."
        />
        <BrandedPage footerLeft="Footer">
          <TocRow number="1" label="Formalities" page={2} />
          <Section title="Table" number="1">
            <View style={s.headerRow}>
              <Text style={[s.cellGroup, s.label, s.tableText]}>Group</Text>
              <Text style={[s.cellNum, s.label, s.tableText]}>Value</Text>
            </View>
            <View style={s.row}>
              <CapturedText
                style={[s.cellGroup, s.tableText]}
                id="t:row1"
                onRowPage={(id, page) => {
                  rowPages[id] = page
                }}
                text="Row 1"
              />
              <Text style={[s.cellNum, s.tableText]}>42</Text>
            </View>
          </Section>
          <SignatureBlock
            columns={["For the employer", "For the union party"]}
            labels={{
              name: "Name",
              signature: "Signature",
              place: "Place",
              date: "Date",
            }}
          />
        </BrandedPage>
      </BrandedDocument>
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
    // Page 1 is the kit's cover; the table sits on the page after it.
    expect(rowPages["t:row1"]).toBe(2)
  })
})

describe("computeHeaderBreaks", () => {
  it("marks rows that start a later page, never a table's first row, and skips unreported rows", () => {
    const tables = [
      ["a:1", "a:2", "a:3"],
      ["b:1", "b:2"],
    ]
    const breaks = computeHeaderBreaks(tables, {
      "a:1": 2,
      "a:2": 2,
      "a:3": 3,
      "b:1": 3,
      "b:2": 4,
    })
    expect([...breaks].sort()).toEqual(["a:3", "b:2"])
    expect([...computeHeaderBreaks(tables, { "a:1": 2, "a:3": 3 })]).toEqual([
      "a:3",
    ])
  })
})
