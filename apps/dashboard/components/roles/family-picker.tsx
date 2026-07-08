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
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { toast } from "sonner"
import { isDuplicateFamilyError } from "@/lib/family-error"

// Sentinel item values: real family ids never collide with these.
const NONE = "__none__"
const CREATE = "__create__"

// Family membership picker: existing families, a none item, and an inline
// create flow (families are born where they are needed; no separate
// management page). value null = no family.
export function FamilyPicker({
  orgId,
  value,
  onChange,
  id,
}: {
  orgId: string
  value: string | null
  onChange: (familyId: string | null) => void
  // Optional id applied to the picker's trigger so a FormLabel/FormControl can
  // associate its label with the control (like CountrySelect et al.).
  id?: string
}) {
  const t = useTranslations("dashboard.roles.family")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const families = useQuery(api.assessment.families.listRoleFamilies, {
    orgId,
  })
  const createFamily = useMutation(api.assessment.families.createRoleFamily)
  const inputId = useId()

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)

  async function handleCreate() {
    const trimmed = name.trim()
    if (trimmed === "" || pending) return
    setPending(true)
    setFailure(null)
    try {
      const familyId = await createFamily({ orgId, name: trimmed })
      setCreating(false)
      setName("")
      onChange(familyId as string)
      toast.success(tToast("familyCreated"))
    } catch (error) {
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
    } finally {
      setPending(false)
    }
  }

  if (creating) {
    return (
      <div className="space-y-2">
        <Label htmlFor={inputId}>{t("nameLabel")}</Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            disabled={name.trim() === "" || pending}
            onClick={handleCreate}
          >
            {t("createCta")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setCreating(false)
              setName("")
              setFailure(null)
            }}
          >
            {t("cancel")}
          </Button>
        </div>
        {failure !== null && (
          <p role="alert" className="text-destructive text-sm">
            {failure === "duplicate" ? tErrors("roleFamilyExists") : t("error")}
          </p>
        )}
      </div>
    )
  }

  return (
    <Select
      items={[
        { value: NONE, label: t("none") },
        ...(families ?? []).map((family) => ({
          value: family.familyId,
          label: family.name,
        })),
        { value: CREATE, label: t("createNew") },
      ]}
      value={value ?? NONE}
      onValueChange={(next) => {
        if (next === CREATE) {
          setCreating(true)
          return
        }
        onChange(next === NONE ? null : next)
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("none")}</SelectItem>
        {(families ?? []).map((family) => (
          <SelectItem key={family.familyId} value={family.familyId}>
            {family.name}
          </SelectItem>
        ))}
        <SelectItem value={CREATE}>{t("createNew")}</SelectItem>
      </SelectContent>
    </Select>
  )
}
