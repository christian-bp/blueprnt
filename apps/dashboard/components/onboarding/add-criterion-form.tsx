"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { importanceLabelKey } from "@/lib/importance"

// Importance levels are offered highest-first so the recommended weight sits at
// the top. The label is shown via importanceLabelKey; the numeric WEIGHT behind
// a level stays inside @workspace/core and never reaches the user.
const IMPORTANCE_OPTIONS = [7, 6, 5, 4, 3, 2, 1]
const EMPTY_ANCHORS = ["", "", "", "", "", ""]

// The add-criterion form: name, description, help text, importance LABEL select
// (never numbers), and six anchor inputs. Posts addCriterion, then resets on
// success. Shared by the scratch editor and the model review screen so both
// paths add criteria with identical behavior. The reactive getModel query in
// the parent picks up the new criterion; this form owns only the add concern.
//
// onAdded is optional: called after a successful add and the form reset, so a
// hosting dialog can close itself once the criterion is persisted.
export function AddCriterionForm({
  orgId,
  onAdded,
}: {
  orgId: string
  onAdded?: () => void
}) {
  const tEditor = useTranslations("dashboard.model.editor")
  const t = useTranslations("dashboard.model")
  const tImportance = useTranslations("model.importance")
  const addCriterion = useMutation(api.evaluationModel.criteria.addCriterion)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [helpText, setHelpText] = useState("")
  const [importanceLevel, setImportanceLevel] = useState("4")
  const [anchors, setAnchors] = useState<string[]>(EMPTY_ANCHORS)
  // pending: add-form submission in flight.
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <form
      className="space-y-4 rounded-md border p-4"
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        setFailed(false)
        try {
          await addCriterion({
            orgId,
            name: name.trim(),
            description,
            helpText,
            importanceLevel: Number(importanceLevel),
            anchors,
          })
          setName("")
          setDescription("")
          setHelpText("")
          setImportanceLevel("4")
          setAnchors(EMPTY_ANCHORS)
          onAdded?.()
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
      <div className="space-y-2">
        <Label id="criterion-importance-label">{tEditor("importance")}</Label>
        <Select value={importanceLevel} onValueChange={setImportanceLevel}>
          <SelectTrigger aria-labelledby="criterion-importance-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IMPORTANCE_OPTIONS.map((level) => (
              <SelectItem key={level} value={String(level)}>
                {tImportance(importanceLabelKey(level))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="space-y-2">
        <legend className="font-medium text-sm">{tEditor("anchors")}</legend>
        {anchors.map((anchor, index) => (
          <div
            // The anchor list is fixed-length and positional, so the index is
            // a stable key here.
            // biome-ignore lint/suspicious/noArrayIndexKey: positional fixed-length list
            key={index}
            className="space-y-1"
          >
            <Label htmlFor={`criterion-anchor-${index}`}>
              {tEditor("anchorLevel", { level: index })}
            </Label>
            <Input
              id={`criterion-anchor-${index}`}
              value={anchor}
              onChange={(event) => {
                const next = [...anchors]
                next[index] = event.target.value
                setAnchors(next)
              }}
            />
          </div>
        ))}
      </fieldset>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      <Button
        type="submit"
        variant="outline"
        disabled={pending || name.trim().length === 0}
      >
        {tEditor("addCta")}
      </Button>
    </form>
  )
}
