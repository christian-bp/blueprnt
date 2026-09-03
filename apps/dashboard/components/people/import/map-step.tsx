"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  BASIS_SELECT_FIELD_KEYS,
  CANONICAL_FIELDS,
  type CanonicalFieldKey,
  defaultBasis,
  detectColumns,
  type PayBasis,
} from "@workspace/import"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { useOrganization } from "@/components/org-context"
import type { ParsedCsv } from "./import-wizard"
import { onSelectValue } from "@/lib/select"

// Sentinel value used in the Select to represent "ignore this column".
const IGNORE_VALUE = "__ignore__"

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Convert a saved import-mapping profile ({ canonicalFieldKey -> sourceHeader })
 * into the wizard's { canonicalFieldKey -> columnIndex } shape, by matching each
 * saved header against the current file's headers (case-insensitive, trimmed).
 * Saved fields whose header is not in the current file are dropped, so a
 * profile from a differently-shaped file degrades gracefully.
 */
export function seedMappingFromProfile(
  parsed: ParsedCsv,
  columnMap: Record<string, string>
): Record<string, number> {
  const normalize = (s: string) => s.trim().toLowerCase()
  const headerIndex = new Map<string, number>()
  parsed.headers.forEach((header, index) => {
    headerIndex.set(normalize(header), index)
  })

  const result: Record<string, number> = {}
  for (const [fieldKey, sourceHeader] of Object.entries(columnMap)) {
    const idx = headerIndex.get(normalize(sourceHeader))
    if (idx !== undefined) {
      result[fieldKey] = idx
    }
  }
  return result
}

/**
 * Run detectColumns and convert the DetectedMapping to the flat
 * Record<CanonicalFieldKey, columnIndex> shape the wizard stores.
 */
export function buildInitialMapping(parsed: ParsedCsv): Record<string, number> {
  const { map } = detectColumns({
    headers: parsed.headers,
    rows: parsed.rows,
    // A headerless file gets content-only suggestions (shapes, not synonyms).
    headerless: parsed.headerless,
    // The engine never reads the clock (ADR-0010); the reference year for the
    // single-date-column birth-vs-start heuristic is read here, in the caller.
    currentYear: new Date().getFullYear(),
  })
  const result: Record<string, number> = {}
  for (const [key, entry] of Object.entries(map)) {
    if (entry !== undefined) {
      result[key] = entry.columnIndex
    }
  }
  return result
}

/**
 * Return a new mapping record with the given field updated.
 * When columnIndex is -1 (not mapped), the key is removed.
 */
export function updateMapping(
  prev: Record<string, number>,
  fieldKey: CanonicalFieldKey,
  columnIndex: number
): Record<string, number> {
  if (columnIndex === -1) {
    const next = { ...prev }
    delete next[fieldKey]
    return next
  }
  return { ...prev, [fieldKey]: columnIndex }
}

/**
 * Invert the mapping lookup: return the field key that currently points at
 * the given column index, or null if no field is assigned to it.
 */
export function columnToField(
  mapping: Record<string, number>,
  columnIndex: number
): CanonicalFieldKey | null {
  for (const [key, idx] of Object.entries(mapping)) {
    if (idx === columnIndex) {
      return key as CanonicalFieldKey
    }
  }
  return null
}

/**
 * Assign a column to a field (last-wins collision).
 * - If fieldKey is null, the column is ignored (any field that pointed at it
 *   is freed).
 * - Assigning col C to field X frees any other column already holding X, AND
 *   frees any field already assigned to col C.
 */
export function assignColumnToField(
  prev: Record<string, number>,
  columnIndex: number,
  fieldKey: CanonicalFieldKey | null
): Record<string, number> {
  const next = { ...prev }

  // Free any field that currently points at this column.
  for (const [key, idx] of Object.entries(next)) {
    if (idx === columnIndex) {
      delete next[key]
    }
  }

  if (fieldKey === null) {
    // Ignore this column: we already freed it above.
    return next
  }

  // Free any column that the target field currently holds.
  delete next[fieldKey]

  // Assign the column to the field.
  next[fieldKey] = columnIndex
  return next
}

// Keep a basis entry for every mapped MONEY column: preserve an existing
// override, else seed from defaultBasis (field default + annual header hint).
// Drops entries for unmapped or non-money fields so basisMap tracks mapping.
export function syncBasisMap(
  mapping: Record<string, number>,
  headers: string[],
  prev: Record<string, PayBasis>
): Record<string, PayBasis> {
  const next: Record<string, PayBasis> = {}
  for (const [fieldKey, columnIndex] of Object.entries(mapping)) {
    if (!BASIS_SELECT_FIELD_KEYS.has(fieldKey)) continue
    next[fieldKey] =
      prev[fieldKey] ?? defaultBasis(fieldKey, headers[columnIndex] ?? "")
  }
  return next
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface MapStepProps {
  parsed: ParsedCsv
  /** Current wizard mapping (canonical field key -> source column index).
   *  Null means not yet seeded; the component will seed it on mount. */
  mapping: Record<string, number> | null
  onMappingChange: (mapping: Record<string, number>) => void
  /** Monthly/annual basis per mapped money field key. */
  basisMap: Record<string, PayBasis>
  onBasisChange: (basisMap: Record<string, PayBasis>) => void
}

export function MapStep({
  parsed,
  mapping,
  onMappingChange,
  basisMap,
  onBasisChange,
}: MapStepProps) {
  const tMap = useTranslations("dashboard.people.import.map")
  const tFields = useTranslations("dashboard.people.import.fields")
  const { orgId } = useOrganization()

  // The org's saved mapping profile (null when none saved). undefined while the
  // query resolves; we wait for it before seeding so the pre-seed is applied.
  const savedProfile = useQuery(
    api.people.importProfile.getImportMappingProfile,
    { orgId }
  )

  // On first entry (mapping === null), seed the wizard. Prefer the saved
  // profile (annual re-run skips re-mapping); fill any field the profile did
  // not cover from auto-detection. Wait for the profile query to resolve.
  // biome-ignore lint/correctness/useExhaustiveDependencies: seeds once when mapping is null and the profile query has resolved; parsed/onMappingChange are stable for the CSV lifetime
  useEffect(() => {
    if (mapping !== null) return
    if (savedProfile === undefined) return
    const auto = buildInitialMapping(parsed)
    const fromProfile =
      savedProfile !== null
        ? seedMappingFromProfile(parsed, savedProfile.columnMap)
        : {}
    // Profile wins per field; auto-detection fills the rest.
    const seeded = { ...auto, ...fromProfile }
    onMappingChange(seeded)
    // Seed the basis toggles too: a saved profile's basis wins per field,
    // else the field default / annual header hint decides.
    onBasisChange(
      syncBasisMap(seeded, parsed.headers, savedProfile?.basisMap ?? {})
    )
  }, [savedProfile])

  // Use the seeded mapping or fall back to an empty object while the effect
  // fires asynchronously (avoids rendering with null).
  const activeMapping: Record<string, number> = mapping ?? {}

  // Compute how many required fields are currently unmapped.
  const unmappedRequiredCount = CANONICAL_FIELDS.filter(
    (f) => f.tier === "required" && !(f.key in activeMapping)
  ).length

  // Handle a column's field assignment changing via the Select.
  // columnSelectValue returns either a CanonicalFieldKey or IGNORE_VALUE.
  // updateMapping uses -1 as its "unmap" sentinel internally; that is a
  // number contract separate from the Select's string values.
  function handleColumnFieldChange(columnIndex: number, value: string) {
    const nextMapping =
      value === IGNORE_VALUE
        ? assignColumnToField(activeMapping, columnIndex, null)
        : assignColumnToField(
            activeMapping,
            columnIndex,
            value as CanonicalFieldKey
          )
    onMappingChange(nextMapping)
    onBasisChange(syncBasisMap(nextMapping, parsed.headers, basisMap))
  }

  // The current Select value for a column: the field key it is assigned to,
  // or IGNORE_VALUE if the column is not mapped.
  function columnSelectValue(columnIndex: number): string {
    const fieldKey = columnToField(activeMapping, columnIndex)
    return fieldKey ?? IGNORE_VALUE
  }

  // Sample values from the first data row for a given column index.
  function columnSamples(columnIndex: number): string[] {
    return parsed.rows
      .slice(0, 3)
      .map((row) => row[columnIndex] ?? "")
      .filter((v) => v !== "")
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-muted-foreground text-sm">{tMap("description")}</p>

      {/* Headerless file: say why the columns are numbered and why most
          suggestions are missing (guidance convention: state it in words). */}
      {parsed.headerless && (
        <p
          data-testid="headerless-notice"
          className="text-muted-foreground text-sm"
        >
          {tMap("headerlessNotice")}
        </p>
      )}

      {/* Unmapped required fields warning */}
      {unmappedRequiredCount > 0 && (
        <p
          data-testid="unmapped-required-warning"
          role="alert"
          className="font-medium text-destructive text-sm"
        >
          {tMap("unmappedRequired", { count: unmappedRequiredCount })}
        </p>
      )}

      {/* Mapping table: one row per CSV column. table-fixed with widths
          declared on the header cells (CLAUDE.md's table anatomy): under the
          default auto layout the table sized itself to the sum of its
          columns' natural content widths, which came out WIDER than the
          scroll wrapper, so the last column's right padding (and the last
          few pixels of its select) fell outside the visible area and were
          clipped at the wrapper's edge, no matter how much padding that
          column carried. Fixed layout forces the table to the wrapper's own
          width; the sample column is the one flexible column (its cell
          already truncates), so it is the one that shrinks to make the
          other three columns' declared widths fit. */}
      <div className="overflow-x-auto rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              {/* w-64: wide enough for most CSV headers plus their mapped
                  field's sub-label; a longer combination (e.g. a long
                  header mapped to "Employment start date") truncates on
                  the cell below rather than overflowing into the next
                  column, with the full text reachable via its title. */}
              <TableHead className="w-64">{tMap("column")}</TableHead>
              <TableHead>{tMap("sample")}</TableHead>
              <TableHead className="w-48">{tMap("mappedTo")}</TableHead>
              {/* w-40 fits the basis select's min-w-[130px] plus this
                  column's own left padding (p-2) and right padding (pr-4,
                  wider than the default p-2 so the select's inset from the
                  table's right edge matches the "Mapped to" select's inset
                  from its own neighbor). */}
              <TableHead className="w-40 pr-4">{tMap("basisHeader")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsed.headers.map((header, columnIndex) => {
              const samples = columnSamples(columnIndex)
              const currentValue = columnSelectValue(columnIndex)
              const currentFieldKey = columnToField(activeMapping, columnIndex)
              const currentFieldLabel = currentFieldKey
                ? tFields(currentFieldKey as Parameters<typeof tFields>[0])
                : null
              // The primary label this row shows for its column: a headerless
              // file shows a localized positional label instead of the
              // synthesized technical name. Also doubles as the cell's title,
              // so the full text is reachable on hover once it truncates.
              const columnLabel = parsed.headerless
                ? tMap("columnNumber", { number: columnIndex + 1 })
                : header

              return (
                <TableRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: column index IS the stable identity for CSV columns
                  key={columnIndex}
                  data-testid={`map-column-${columnIndex}`}
                >
                  {/* CSV column header name, plus its mapped field's
                      sub-label when set, on one line: truncates instead of
                      overflowing into the sample column now that the table
                      is fixed-layout, with the full text on the title. */}
                  <TableCell>
                    <div title={columnLabel} className="min-w-0 truncate">
                      <span className="font-medium text-sm">{columnLabel}</span>
                      {currentFieldLabel !== null && (
                        <span className="ml-2 text-muted-foreground text-xs">
                          {currentFieldLabel}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Sample values from first few data rows. Truncated so a
                      long value cannot push the field selector out of view;
                      the full text stays available via the title tooltip. */}
                  <TableCell>
                    <span
                      title={samples.join(", ")}
                      className="block max-w-[26rem] truncate font-mono text-muted-foreground text-sm"
                    >
                      {samples.join(", ")}
                    </span>
                  </TableCell>

                  {/* Field assignment selector */}
                  <TableCell>
                    <Select
                      value={currentValue}
                      onValueChange={onSelectValue((value: string) =>
                        handleColumnFieldChange(columnIndex, value)
                      )}
                      items={{
                        [IGNORE_VALUE]: tMap("ignore"),
                        ...Object.fromEntries(
                          CANONICAL_FIELDS.map((field) => [
                            field.key,
                            tFields(field.key as Parameters<typeof tFields>[0]),
                          ])
                        ),
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        className="min-w-[160px]"
                        aria-label={header}
                        data-testid={`map-column-${columnIndex}-trigger`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value={IGNORE_VALUE}
                          data-testid={`map-column-${columnIndex}-option-ignore`}
                        >
                          {tMap("ignore")}
                        </SelectItem>
                        {CANONICAL_FIELDS.map((field) => (
                          <SelectItem
                            key={field.key}
                            value={field.key}
                            data-testid={`map-column-${columnIndex}-option-${field.key}`}
                          >
                            {tFields(
                              field.key as Parameters<typeof tFields>[0]
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Monthly/annual basis toggle: only for money-shaped
                      fields. The cell renders empty (not omitted) for other
                      rows so every row keeps the same column count. pr-4
                      matches the header cell's extra right inset; the
                      column's own width comes from the header (table-fixed). */}
                  <TableCell className="pr-4">
                    {currentFieldKey &&
                    BASIS_SELECT_FIELD_KEYS.has(currentFieldKey) ? (
                      <Select
                        value={
                          basisMap[currentFieldKey] ??
                          defaultBasis(currentFieldKey, header)
                        }
                        onValueChange={onSelectValue((value: string) =>
                          onBasisChange({
                            ...basisMap,
                            [currentFieldKey]: value as PayBasis,
                          })
                        )}
                        items={{
                          monthly: tMap("basisMonthly"),
                          annual: tMap("basisAnnual"),
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          className="min-w-[130px]"
                          aria-label={tMap("basisHeader")}
                          data-testid={`map-column-${columnIndex}-basis-trigger`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">
                            {tMap("basisMonthly")}
                          </SelectItem>
                          <SelectItem value="annual">
                            {tMap("basisAnnual")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
