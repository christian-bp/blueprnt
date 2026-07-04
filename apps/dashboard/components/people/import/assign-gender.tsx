"use client"

import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"

export interface AssignGenderProps {
  /** Rows flagged unresolvedGender, identified by their externalRef cell. */
  flagged: Array<{ externalRef: string; rowIndex: number }>
  /** Current choices (controlled). */
  value: Record<string, "Man" | "Kvinna">
  onChange: (next: Record<string, "Man" | "Kvinna">) => void
}

const GENDERS: ReadonlyArray<"Man" | "Kvinna"> = ["Man", "Kvinna"]

export function AssignGender({ flagged, value, onChange }: AssignGenderProps) {
  const tCheck = useTranslations("dashboard.people.import.check")
  const tGender = useTranslations("dashboard.people.import.gender")

  function pick(externalRef: string, gender: "Man" | "Kvinna") {
    onChange({ ...value, [externalRef]: gender })
  }

  return (
    <div data-testid="assign-gender" className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium text-sm">
          {tCheck("assignGender.heading")}
        </h3>
        <p className="text-muted-foreground text-sm">
          {tCheck("assignGender.help")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {flagged.map(({ externalRef }) => (
          <div
            key={externalRef}
            data-testid={`assign-gender-${externalRef}`}
            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
          >
            <span className="font-mono text-sm">{externalRef}</span>
            <div className="flex gap-1">
              {GENDERS.map((g) => (
                <Button
                  key={g}
                  type="button"
                  size="sm"
                  variant={value[externalRef] === g ? "default" : "outline"}
                  aria-pressed={value[externalRef] === g}
                  onClick={() => pick(externalRef, g)}
                  data-testid={`assign-gender-${externalRef}-${g}`}
                >
                  {tGender(g)}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
