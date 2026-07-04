"use client"

import {
  type CanonicalFieldKey,
  classifyColumn,
  parseCurrency,
  parseGender,
  parseMoney,
  parsePercent,
} from "@workspace/import"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useAction } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import type { ParsedCsv } from "./import-wizard"

// Maximum number of rows to show in the preview table.
const PREVIEW_ROW_COUNT = 10

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the columnMap array-of-pairs required by importPayroll.
 * Shape: Array<[sourceHeader: string, canonicalKey: string]>
 * Only includes entries that map to a valid column index.
 */
export function buildColumnMap(
  mapping: Record<string, number>,
  headers: string[]
): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  for (const [canonicalKey, columnIndex] of Object.entries(mapping)) {
    if (
      columnIndex !== undefined &&
      columnIndex >= 0 &&
      columnIndex < headers.length
    ) {
      const header = headers[columnIndex]
      if (header !== undefined) {
        pairs.push([header, canonicalKey])
      }
    }
  }
  return pairs
}

// A single normalized preview row.
interface PreviewRow {
  displayName: string
  basicMonthly: number | null
  currency: string | null
  ftePercent: number | null
  gender: string | null
}

/**
 * Normalize up to PREVIEW_ROW_COUNT data rows using the parsers from
 * @workspace/import so the preview shows the same values the backend will
 * actually import.
 */
function buildPreviewRows(
  parsed: ParsedCsv,
  mapping: Record<string, number>
): PreviewRow[] {
  const col = (key: CanonicalFieldKey): number | undefined => {
    const idx = mapping[key]
    return idx !== undefined && idx >= 0 && idx < parsed.headers.length
      ? idx
      : undefined
  }

  const firstNameCol = col("firstName")
  const lastNameCol = col("lastName")
  const externalRefCol = col("externalRef")
  const basicMonthlyCol = col("basicMonthly")
  const currencyCol = col("currency")
  const ftePercentCol = col("ftePercent")
  const genderCol = col("gender")

  // Determine once whether the FTE column is fractional (values <= 1.0). The
  // backend classifies the whole column and scales x100; mirror that here so the
  // preview value matches the imported value (classifyColumn over ALL rows, not
  // just the previewed slice, so the fraction verdict is the column's, not the
  // preview window's).
  const fteIsFraction =
    ftePercentCol !== undefined &&
    classifyColumn(parsed.rows.map((r) => r[ftePercentCol] ?? "")).fraction ===
      true

  const rows = parsed.rows.slice(0, PREVIEW_ROW_COUNT)

  return rows.map((row) => {
    const cell = (colIdx: number | undefined): string =>
      colIdx !== undefined ? (row[colIdx] ?? "").trim() : ""

    const firstName = cell(firstNameCol)
    const lastName = cell(lastNameCol)
    const externalRef = cell(externalRefCol)
    const displayName =
      [firstName, lastName].filter(Boolean).join(" ") || externalRef

    const basicMonthlyRaw = cell(basicMonthlyCol)
    const basicMonthly = basicMonthlyRaw ? parseMoney(basicMonthlyRaw) : null

    const currencyRaw = cell(currencyCol)
    const currency = currencyRaw ? parseCurrency(currencyRaw) : null

    const ftePercentRaw = cell(ftePercentCol)
    const ftePercent = ftePercentRaw
      ? parsePercent(ftePercentRaw, { fraction: fteIsFraction })
      : null

    const genderRaw = cell(genderCol)
    const gender = genderRaw ? parseGender(genderRaw) : null

    return { displayName, basicMonthly, currency, ftePercent, gender }
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ReviewStepProps {
  parsed: ParsedCsv
  mapping: Record<string, number>
  csvText: string
  /** Number of rows that the check step flagged with issues. */
  flaggedCount: number
  /** Per-row manual gender assignments, keyed by trimmed externalRef. */
  genderOverrides: Record<string, "Man" | "Kvinna">
}

export function ReviewStep({
  parsed,
  mapping,
  csvText,
  flaggedCount,
  genderOverrides,
}: ReviewStepProps) {
  const t = useTranslations("dashboard.people.import.review")
  const tFields = useTranslations("dashboard.people.import.fields")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const router = useRouter()

  const importPayroll = useAction(api.people.import.importPayroll)

  const [isSubmitting, setIsSubmitting] = useState(false)
  // Returned when ok:false (should not happen if check step gated correctly).
  const [blockingError, setBlockingError] = useState<string[] | null>(null)

  const previewRows = buildPreviewRows(parsed, mapping)
  const columnMap = buildColumnMap(mapping, parsed.headers)

  async function handleConfirm() {
    setIsSubmitting(true)
    setBlockingError(null)
    try {
      // Convert the ergonomic record to the Convex array-of-pairs Plan D expects.
      // Omit the arg entirely when there is nothing to override.
      const genderOverridePairs = Object.entries(genderOverrides) as Array<
        [string, "Man" | "Kvinna"]
      >
      const result = await importPayroll({
        orgId,
        csvText,
        columnMap,
        ...(genderOverridePairs.length > 0
          ? { genderOverrides: genderOverridePairs }
          : {}),
      })
      if (result.ok) {
        toast.success(tToast("peopleImported"))
        router.push("/people")
      } else {
        // Required fields were not mapped — surface the blocking list.
        setBlockingError(result.validation.blocking)
      }
    } catch {
      toast.error(tToast("error"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const previewCount = Math.min(PREVIEW_ROW_COUNT, parsed.rows.length)

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Unexpected blocking error from the action */}
      {blockingError !== null && blockingError.length > 0 && (
        <Alert variant="destructive" data-testid="blocking-error">
          <AlertTitle>{t("blockingTitle")}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-4">
              {blockingError.map((key) => (
                <li key={key}>
                  {tFields(key as Parameters<typeof tFields>[0])}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary line */}
      <p className="text-muted-foreground text-sm" data-testid="summary">
        {t("summary", {
          people: parsed.rows.length,
          flagged: flaggedCount,
        })}
      </p>

      {/* Preview table */}
      <div data-testid="preview-table">
        <h3 className="mb-3 font-medium text-sm">
          {t("preview", { count: previewCount })}
        </h3>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tFields("firstName")}</TableHead>
                <TableHead>{tFields("basicMonthly")}</TableHead>
                <TableHead>{tFields("currency")}</TableHead>
                <TableHead>{tFields("ftePercent")}</TableHead>
                <TableHead>{tFields("gender")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: preview rows have no stable id; row index is the correct key here
                <TableRow key={idx} data-testid={`preview-row-${idx}`}>
                  <TableCell className="font-medium">
                    {row.displayName}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.basicMonthly !== null
                      ? row.basicMonthly.toLocaleString("sv-SE")
                      : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.currency ?? ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.ftePercent !== null ? `${row.ftePercent}%` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.gender ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Confirm button */}
      <SubmitButton
        isSubmitting={isSubmitting}
        onClick={handleConfirm}
        data-testid="confirm-button"
      >
        {isSubmitting ? t("importing") : t("confirm")}
      </SubmitButton>
    </div>
  )
}
