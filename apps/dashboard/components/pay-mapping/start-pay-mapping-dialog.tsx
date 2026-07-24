"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { HelpMorphButton } from "@/components/help-morph-button"
import { PayMappingPreconditionsPanel } from "@/components/pay-mapping/pay-mapping-preconditions-panel"
import { SubmitButton } from "@/components/submit-button"
import {
  makeStartRunSchema,
  type StartRunValues,
} from "@/lib/pay-mapping-schemas"

// Starts a new pay mapping (kartlaggning): the only field is a label. The
// reference date is fixed to today by the backend at call time (the mutation
// freezes the model config and the population as of now), so a HelpMorphButton
// beside the title explains that instead of a form field. The create
// affordance always stays visible and clickable (the guidance rule: never
// silently disabled): when the pay-mapping gate is unmet, opening the dialog
// shows the precondition panel instead of the label form. The mutation
// re-derives the identical check server-side regardless, so this is
// convenience, never the authority.
export function StartPayMappingDialog({
  orgId,
  triggerLabel,
}: {
  orgId: string
  triggerLabel: string
}) {
  const t = useTranslations("dashboard.payMapping.start")
  const tHelp = useTranslations("dashboard.help")
  const tv = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")
  const startPayMappingRun = useMutation(api.payMapping.runs.startPayMappingRun)
  const preconditions = useQuery(
    api.payMapping.runs.getPayMappingPreconditions,
    { orgId }
  )
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)

  const schema = useMemo(() => makeStartRunSchema(tv), [tv])
  const form = useForm<StartRunValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { label: "" },
  })

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    // Closing discards the draft: a reopened dialog always starts clean.
    if (!nextOpen) {
      form.reset()
      setFailed(false)
    }
  }

  async function onSubmit(values: StartRunValues) {
    setFailed(false)
    try {
      const { slug } = await startPayMappingRun({
        orgId,
        label: values.label,
      })
      toast.success(tToast("payMappingStarted"))
      setOpen(false)
      router.push(`/pay-mappings/${slug}`)
    } catch {
      setFailed(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        {preconditions !== undefined && !preconditions.ready ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
            </DialogHeader>
            <PayMappingPreconditionsPanel
              peopleCount={preconditions.peopleCount}
              unclassifiedCount={preconditions.unclassifiedCount}
              unevaluatedRoles={preconditions.unevaluatedRoles}
            />
          </>
        ) : preconditions === undefined ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-1.5">
                <DialogTitle>{t("title")}</DialogTitle>
                <HelpMorphButton label={tHelp("referenceDateLabel")}>
                  {tHelp("referenceDateBody")}
                </HelpMorphButton>
              </div>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("labelLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("labelPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {failed && (
                  <p role="alert" className="text-destructive text-sm">
                    {t("error")}
                  </p>
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <SubmitButton
                    type="submit"
                    isSubmitting={form.formState.isSubmitting}
                    disabled={!form.formState.isValid}
                  >
                    {t("cta")}
                  </SubmitButton>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
