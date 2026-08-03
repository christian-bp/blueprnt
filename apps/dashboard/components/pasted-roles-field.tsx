"use client"

import { MAX_STARTER_IMPORT_TEXT } from "@workspace/constants"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { HelpMorphButton } from "@/components/help-morph-button"
import { TypewriterPlaceholder } from "@/components/typewriter-placeholder"

// The paste-your-roles field, shared by the onboarding families step and the
// in-app role import. All copy is injected: the two surfaces address different
// situations (a first-run org versus one that already has a register), so they
// keep their own i18n keys while sharing the markup and the input cap.
//
// The field and its hint are one block (tighter than the surrounding section),
// so the hint reads as belonging to the textarea. Styled like the design
// system's FormDescription; this input is not a react-hook-form field, so the
// describedby link is wired by hand.
export function PastedRolesField({
  id,
  value,
  onChange,
  label,
  helpLabel,
  helpBody,
  hint,
  placeholderPhrases,
  disabled = false,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  label: string
  helpLabel: string
  helpBody: string
  hint: string
  placeholderPhrases: string[]
  // A caller holding the screen for something other than this field's own
  // value (an in-flight request, a possible resume) disables it: the field
  // stays on screen so the layout does not change shape, but nothing typed
  // into it would survive whatever the hold is waiting for.
  disabled?: boolean
}) {
  const hintId = `${id}-hint`
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        <HelpMorphButton label={helpLabel}>{helpBody}</HelpMorphButton>
      </div>
      <div className="space-y-1.5">
        <div className="relative">
          <Textarea
            id={id}
            aria-describedby={hintId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-40"
            maxLength={MAX_STARTER_IMPORT_TEXT}
            disabled={disabled}
          />
          {/* Suppressed while disabled: an animated invitation to type over a
              field that cannot be typed into would contradict its own state. */}
          {!disabled && value === "" && (
            <TypewriterPlaceholder phrases={placeholderPhrases} />
          )}
        </div>
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      </div>
    </div>
  )
}
