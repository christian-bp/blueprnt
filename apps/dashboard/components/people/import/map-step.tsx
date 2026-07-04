"use client"

import {
  CANONICAL_FIELDS,
  type CanonicalFieldKey,
  type FieldTier,
  detectColumns,
} from "@workspace/import"
import { Badge } from "@workspace/ui/components/badge"
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

// ---------------------------------------------------------------------------
// Badge variant per tier
// ---------------------------------------------------------------------------

function tierBadgeVariant(
  tier: FieldTier
): "destructive" | "secondary" | "outline" {
  switch (tier) {
    case "required":
      return "destructive"
    case "recommended":
      return "secondary"
    case "optional":
      return "outline"
  }
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
  const tTier = useTranslations("dashboard.people.import.tier")

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

  // Confidence hint from the last detectColumns run, indexed by field key.
  // Re-compute from the current parsed data so the hint reflects the mapping.
  const confidenceMap: Partial<Record<CanonicalFieldKey, number>> = (() => {
    const { map } = detectColumns({
      headers: parsed.headers,
      rows: parsed.rows,
    })
    const out: Partial<Record<CanonicalFieldKey, number>> = {}
    for (const [key, entry] of Object.entries(map)) {
      if (entry !== undefined) {
        out[key as CanonicalFieldKey] = entry.confidence
      }
    }
    return out
  })()

  function handleSelectChange(fieldKey: CanonicalFieldKey, value: string) {
    const columnIndex = value === NOT_MAPPED_VALUE ? -1 : Number(value)
    onMappingChange(updateMapping(activeMapping, fieldKey, columnIndex))
  }

  function selectValue(fieldKey: CanonicalFieldKey): string {
    const idx = activeMapping[fieldKey]
    return idx !== undefined ? String(idx) : NOT_MAPPED_VALUE
  }

  // Sample value: first data row's cell at the mapped column.
  function sampleValue(fieldKey: CanonicalFieldKey): string {
    const idx = activeMapping[fieldKey]
    if (idx === undefined) return ""
    return parsed.rows[0]?.[idx] ?? ""
  }

  function confidencePercent(fieldKey: CanonicalFieldKey): string {
    const c = confidenceMap[fieldKey]
    if (c === undefined) return ""
    return `${Math.round(c * 100)}%`
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

      {/* Mapping table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tMap("field")}</TableHead>
              <TableHead>{tMap("source")}</TableHead>
              <TableHead>{tMap("sample")}</TableHead>
              <TableHead>{tMap("confidence")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CANONICAL_FIELDS.map((field) => {
              const fieldLabel = tFields(
                field.key as Parameters<typeof tFields>[0]
              )
              const tierLabel = tTier(field.tier)
              return (
                <TableRow key={field.key} data-testid={`map-row-${field.key}`}>
                  {/* Field name + tier badge */}
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{fieldLabel}</span>
                      <Badge variant={tierBadgeVariant(field.tier)}>
                        {tierLabel}
                      </Badge>
                    </div>
                  </TableCell>

                  {/* Source column selector */}
                  <TableCell>
                    <Select
                      value={selectValue(field.key)}
                      onValueChange={(value) =>
                        handleSelectChange(field.key, value)
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        className="min-w-[160px]"
                        aria-label={fieldLabel}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NOT_MAPPED_VALUE}>
                          {tMap("notMapped")}
                        </SelectItem>
                        {parsed.headers.map((header, idx) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: column index is the correct stable key here — it IS the value stored in the mapping
                          <SelectItem key={idx} value={String(idx)}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Sample value from first data row */}
                  <TableCell>
                    <span className="font-mono text-muted-foreground text-sm">
                      {sampleValue(field.key)}
                    </span>
                  </TableCell>

                  {/* Confidence hint */}
                  <TableCell>
                    <span className="text-muted-foreground text-xs">
                      {confidencePercent(field.key)}
                    </span>
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
