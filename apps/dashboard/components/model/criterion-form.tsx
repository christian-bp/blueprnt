"use client"

import { Button } from "@workspace/ui/components/button"
import { DialogFooter } from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"

const EMPTY_ANCHORS = ["", "", "", "", "", ""]

export interface CriterionFormValues {
  name: string
  description: string
  helpText: string
  anchors: string[]
}

// The shared criterion form: name, description, help text, and six anchor
// inputs, used by both the add and the edit dialog. There is no weight
// input: a new criterion always enters at the neutral 3 weight points so the
// allocation stays exactly on the point budget (ADR-0004), and existing
// weights are changed in the editor's zero-sum flow, never here.
//
// The form owns only field state; the hosting dialog owns the mutation via
// onSubmit (which throws on failure). Without initialValues the fields reset
// after a successful submit (add mode); with initialValues they keep the
// saved state (edit mode; the host closes the dialog). onCancel renders the
// footer's cancel button; it is a plain callback so the form stays
// renderable outside a Dialog context.
export function CriterionForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues?: CriterionFormValues
  submitLabel: string
  onSubmit: (values: CriterionFormValues) => Promise<void>
  onCancel?: () => void
}) {
  const tEditor = useTranslations("dashboard.model.editor")
  const t = useTranslations("dashboard.model")
  const tHelp = useTranslations("dashboard.help")

  const [name, setName] = useState(initialValues?.name ?? "")
  const [description, setDescription] = useState(
    initialValues?.description ?? ""
  )
  const [helpText, setHelpText] = useState(initialValues?.helpText ?? "")
  const [anchors, setAnchors] = useState<string[]>(
    initialValues?.anchors ?? EMPTY_ANCHORS
  )
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        setFailed(false)
        try {
          await onSubmit({ name: name.trim(), description, helpText, anchors })
          if (initialValues === undefined) {
            setName("")
            setDescription("")
            setHelpText("")
            setAnchors(EMPTY_ANCHORS)
          }
        } catch {
          setFailed(true)
        } finally {
          setPending(false)
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="criterion-name">{tEditor("name")}</Label>
        <Input
          id="criterion-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="criterion-description">{tEditor("description")}</Label>
        <Textarea
          id="criterion-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="criterion-help-text">{tEditor("helpText")}</Label>
        <Textarea
          id="criterion-help-text"
          value={helpText}
          onChange={(event) => setHelpText(event.target.value)}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="font-medium text-sm">
          <span className="flex items-center gap-1.5">
            {tEditor("anchors")}
            <HelpMorphButton label={tHelp("anchorsLabel")}>
              {tHelp("anchorsBody")}
            </HelpMorphButton>
          </span>
        </legend>
        {/* Static helper line: states the 0-to-5 direction in plain language
            so the six inputs read as the levels of the scale, not as a list
            of names. Always present (no state-triggered reveal), so the
            layout never shifts. */}
        <p className="text-muted-foreground text-sm">
          {tEditor("levelsIntro")}
        </p>
        {anchors.map((anchor, index) => {
          const isLowest = index === 0
          const isHighest = index === anchors.length - 1
          const levelLabel = tEditor("anchorLevel", { level: index })
          return (
            <div
              // The anchor list is fixed-length and positional, so the index
              // is a stable key here.
              // biome-ignore lint/suspicious/noArrayIndexKey: positional fixed-length list
              key={index}
              className="space-y-1"
            >
              <Label
                htmlFor={`criterion-anchor-${index}`}
                className="flex items-center gap-2"
              >
                {/* Fixed-width numeric badge so the number reads as scale
                    position, not part of the label text. */}
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs tabular-nums">
                  {index}
                </span>
                {levelLabel}
                {isLowest && (
                  <span className="text-muted-foreground text-xs">
                    {tEditor("levelEndpointLowest")}
                  </span>
                )}
                {isHighest && (
                  <span className="text-muted-foreground text-xs">
                    {tEditor("levelEndpointHighest")}
                  </span>
                )}
              </Label>
              <Input
                id={`criterion-anchor-${index}`}
                // Explicit accessible name so the input is "Level N" even
                // though the visible Label also holds the badge and endpoint
                // tag; aria-label overrides the associated label text in the
                // accessible-name computation. Keeps getByLabelText("Level N")
                // working.
                aria-label={levelLabel}
                value={anchor}
                placeholder={
                  isLowest
                    ? tEditor("levelPlaceholderLowest")
                    : isHighest
                      ? tEditor("levelPlaceholderHighest")
                      : undefined
                }
                onChange={(event) => {
                  const next = [...anchors]
                  next[index] = event.target.value
                  setAnchors(next)
                }}
              />
            </div>
          )
        })}
      </fieldset>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      <DialogFooter>
        {onCancel !== undefined && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {tEditor("cancelCta")}
          </Button>
        )}
        <Button type="submit" disabled={pending || name.trim().length === 0}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
