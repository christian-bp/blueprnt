"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@workspace/ui/components/button"
import { DialogFooter } from "@workspace/ui/components/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SubmitButton } from "@/components/submit-button"
import {
  type CriterionFormValues,
  makeCriterionSchema,
} from "@/lib/criterion-schemas"

const EMPTY_ANCHORS = ["", "", "", "", "", ""]

// Re-exported so the host dialogs (add/edit) and tests keep importing the
// criterion value type from the form, while it stays schema-derived.
export type { CriterionFormValues }

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
  const tv = useTranslations("dashboard.validation")

  const schema = useMemo(() => makeCriterionSchema(tv), [tv])
  const form = useForm<CriterionFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: initialValues ?? {
      name: "",
      description: "",
      helpText: "",
      anchors: EMPTY_ANCHORS,
    },
  })
  const anchors = form.getValues("anchors")
  // Destructure so all three are READ every render: RHF's formState proxy only
  // tracks/updates fields that are accessed, and a short-circuiting
  // `!isValid || !isDirty` would never read isDirty on the first render.
  const { isValid, isDirty, isSubmitting } = form.formState
  const [failed, setFailed] = useState(false)

  async function handleValid(values: CriterionFormValues) {
    setFailed(false)
    try {
      await onSubmit(values)
      // Add mode (no initialValues): clear the fields for the next criterion.
      if (initialValues === undefined) {
        form.reset({
          name: "",
          description: "",
          helpText: "",
          anchors: ["", "", "", "", "", ""],
        })
      }
    } catch {
      setFailed(true)
    }
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(handleValid)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{tEditor("name")}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <Label htmlFor="criterion-description">
            {tEditor("description")}
          </Label>
          <Textarea
            id="criterion-description"
            {...form.register("description")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="criterion-help-text">{tEditor("helpText")}</Label>
          <Textarea id="criterion-help-text" {...form.register("helpText")} />
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
          {anchors.map((_anchor, index) => {
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
                  placeholder={
                    isLowest
                      ? tEditor("levelPlaceholderLowest")
                      : isHighest
                        ? tEditor("levelPlaceholderHighest")
                        : undefined
                  }
                  {...form.register(`anchors.${index}` as const)}
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
          <SubmitButton
            type="submit"
            isSubmitting={isSubmitting}
            // Also require a change: in edit mode (prefilled) this blocks a no-op
            // save; in add mode isValid already implies a change (the name is
            // required), so this only ever matters for edits.
            disabled={!isValid || !isDirty}
          >
            {submitLabel}
          </SubmitButton>
        </DialogFooter>
      </form>
    </Form>
  )
}
