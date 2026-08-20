"use client"

import { AiEditingIcon } from "@hugeicons/core-free-icons"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { useTranslations } from "next-intl"
import type { UseFormReturn } from "react-hook-form"
import { useWatch } from "react-hook-form"
import { HelpMorphButton } from "@/components/help-morph-button"
import { MorphPopover } from "@/components/morph-popover"
import { FamilyPicker } from "@/components/roles/family-picker"
import { RoleAiPanel } from "@/components/roles/role-ai-panel"
import type { CreateRoleValues } from "@/lib/role-schemas"

// The identity labels differ per surface (the roles register and the classify
// screen name the same fields from their own namespaces), so they are passed
// in rather than read from one namespace here. Everything else in this form
// (the job profile, its help, the AI panel) is the same copy on both.
export interface RoleFormLabels {
  title: string
  titlePlaceholder?: string
  roleFunction: string
  team: string
  track: string
}

// Structural subset: key is a plain string at the JS layer; the form schema
// validates it against the track union before submit.
export interface RoleFormTrack {
  key: string
  name: string
}

// The AI draft trigger, in its own component so the identity watch lives HERE
// rather than in the form body: useWatch re-renders its host on every
// keystroke, and only this subtree actually depends on the typed values.
function RoleDraftPopover({
  orgId,
  form,
}: {
  orgId: string
  form: UseFormReturn<CreateRoleValues>
}) {
  const t = useTranslations("dashboard.roles.form")
  const tAi = useTranslations("dashboard.ai")

  // The draft is generated from what is currently typed, so the panel watches
  // the identity fields rather than reading them once at mount.
  const [title, roleFunction, team, trackKey, familyId] = useWatch({
    control: form.control,
    name: ["title", "roleFunction", "team", "trackKey", "familyId"],
  })

  return (
    <MorphPopover
      triggerLabel={tAi("fillCta")}
      triggerIcon={AiEditingIcon}
      title={tAi("heading")}
      description={t("aiProvenance")}
      closeLabel={tAi("closeLabel")}
      // Narrower than the default card panel: the dialog it opens inside is
      // only sm:max-w-lg wide.
      contentClassName="w-[22rem] max-w-[calc(100vw-5rem)]"
    >
      {(close) => (
        <RoleAiPanel
          orgId={orgId}
          source={{
            kind: "draft",
            identity: { title, roleFunction, team, trackKey, familyId },
          }}
          onFilled={({ purpose, responsibilities }) => {
            if (purpose.trim()) {
              form.setValue("purpose", purpose, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            if (responsibilities.trim()) {
              form.setValue("responsibilities", responsibilities, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          }}
          onDone={close}
        />
      )}
    </MorphPopover>
  )
}

// The create-role form body, shared by both dialogs that create a role (the
// roles/family register and the classify screen's unmatched-title action).
// It owns the fields only: each dialog keeps its own chrome, submit, and
// error handling.
export function RoleFormFields({
  orgId,
  form,
  labels,
  tracks,
  showFamily,
}: {
  orgId: string
  form: UseFormReturn<CreateRoleValues>
  labels: RoleFormLabels
  tracks: RoleFormTrack[]
  // The family picker is hidden where the family is fixed by context (a family
  // page) or absent by design (classification creates family-less roles).
  showFamily: boolean
}) {
  const t = useTranslations("dashboard.roles.form")
  const tRole = useTranslations("assessment.role")
  const tHelp = useTranslations("dashboard.help")
  const tModel = useTranslations("model")

  return (
    <>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{labels.title}</FormLabel>
            <FormControl>
              <Input placeholder={labels.titlePlaceholder} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="roleFunction"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.roleFunction}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="team"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.team}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="trackKey"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-1.5">
              <FormLabel>{labels.track}</FormLabel>
              <HelpMorphButton label={tHelp("trackLabel")}>
                {tHelp("trackBody")}
              </HelpMorphButton>
            </div>
            <Select
              value={field.value}
              onValueChange={field.onChange}
              items={tracks.map((track) => ({
                value: track.key,
                label: track.name,
              }))}
            >
              <FormControl>
                <SelectTrigger
                  ref={field.ref}
                  onBlur={field.onBlur}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {tracks.map((track) => (
                  <SelectItem key={track.key} value={track.key}>
                    {track.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {showFamily && (
        <FormField
          control={form.control}
          name="familyId"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-1.5">
                <FormLabel>{tModel("roleFamily")}</FormLabel>
                <HelpMorphButton label={tHelp("familyLabel")}>
                  {tHelp("familyBody")}
                </HelpMorphButton>
              </div>
              <FormControl>
                <FamilyPicker
                  orgId={orgId}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value)
                    // The family is the uniqueness scope, so re-check the
                    // title against the newly selected family.
                    void form.trigger("title")
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />
      )}
      <FormField
        control={form.control}
        name="purpose"
        render={({ field }) => (
          <FormItem>
            {/* The AI trigger sits on the purpose label row, in a fixed-height
                slot shared with the label, so opening the panel (which
                overlays, never reflows) leaves the fields below in place. */}
            <div className="flex h-8 items-center justify-between gap-2">
              <FormLabel>{tRole("purpose")}</FormLabel>
              <RoleDraftPopover orgId={orgId} form={form} />
            </div>
            <FormControl>
              <Textarea rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="responsibilities"
        render={({ field }) => (
          <FormItem>
            {/* Matches the purpose row's height so the two labels align. */}
            <div className="flex h-8 items-center">
              <FormLabel>{tRole("responsibilities")}</FormLabel>
            </div>
            <FormControl>
              <Textarea rows={3} {...field} />
            </FormControl>
            {/* Responsibilities render one-per-line as a list on the role
                page, so tell the editor to write one per row. */}
            <p className="text-muted-foreground text-sm">
              {t("responsibilitiesHint")}
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
