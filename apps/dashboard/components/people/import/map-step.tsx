"use client"

import {
  CANONICAL_FIELDS,
  type CanonicalFieldKey,
  detectColumns,
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
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import type { ParsedCsv } from "./import-wizard"

// Sentinel value used in the Select to represent "not mapped".
// A string is required by Radix Select; we convert to/from the number -1.
const NOT_MAPPED_VALUE = "__not_mapped__"

// Sentinel value used in the Select to represent "ignore this column".
const IGNORE_VALUE = "__ignore__"

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Run detectColumns and convert the DetectedMapping to the flat
 * Record<CanonicalFieldKey, columnIndex> shape the wizard stores.
 */
export function buildInitialMapping(parsed: ParsedCsv): Record<string, number> {
  const { map } = detectColumns({ headers: parsed.headers, rows: parsed.rows })
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
    // Ignore this column — we already freed it above.
    return next
  }

  // Free any column that the target field currently holds.
  delete next[fieldKey]

  // Assign the column to the field.
  next[fieldKey] = columnIndex
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
}

export function MapStep({ parsed, mapping, onMappingChange }: MapStepProps) {
  const tMap = useTranslations("dashboard.people.import.map")
  const tFields = useTranslations("dashboard.people.import.fields")

  // On first entry (mapping === null), run auto-detection and seed the wizard.
  // This effect only fires once because we check mapping === null as the guard.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only runs when mapping is null; parsed/onMappingChange are stable for the lifetime of a CSV
  useEffect(() => {
    if (mapping === null) {
      onMappingChange(buildInitialMapping(parsed))
    }
  }, [])

  // Use the seeded mapping or fall back to an empty object while the effect
  // fires asynchronously (avoids rendering with null).
  const activeMapping: Record<string, number> = mapping ?? {}

  // Compute how many required fields are currently unmapped.
  const unmappedRequiredCount = CANONICAL_FIELDS.filter(
    (f) => f.tier === "required" && !(f.key in activeMapping)
  ).length

  // Handle a column's field assignment changing via the Select.
  function handleColumnFieldChange(columnIndex: number, value: string) {
    if (value === IGNORE_VALUE || value === NOT_MAPPED_VALUE) {
      onMappingChange(assignColumnToField(activeMapping, columnIndex, null))
    } else {
      onMappingChange(
        assignColumnToField(
          activeMapping,
          columnIndex,
          value as CanonicalFieldKey
        )
      )
    }
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

      {/* Mapping table — one row per CSV column */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tMap("column")}</TableHead>
              <TableHead>{tMap("sample")}</TableHead>
              <TableHead>{tMap("mappedTo")}</TableHead>
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

              return (
                <TableRow key={header} data-testid={`map-col-${header}`}>
                  {/* CSV column header name */}
                  <TableCell>
                    <span className="font-medium text-sm">{header}</span>
                    {currentFieldLabel !== null && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        {currentFieldLabel}
                      </span>
                    )}
                  </TableCell>

                  {/* Sample values from first few data rows */}
                  <TableCell>
                    <span className="font-mono text-muted-foreground text-sm">
                      {samples.join(", ")}
                    </span>
                  </TableCell>

                  {/* Field assignment selector */}
                  <TableCell>
                    <Select
                      value={currentValue}
                      onValueChange={(value) =>
                        handleColumnFieldChange(columnIndex, value)
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        className="min-w-[160px]"
                        aria-label={header}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IGNORE_VALUE}>
                          {tMap("ignore")}
                        </SelectItem>
                        {CANONICAL_FIELDS.map((field) => (
                          <SelectItem key={field.key} value={field.key}>
                            {tFields(
                              field.key as Parameters<typeof tFields>[0]
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
