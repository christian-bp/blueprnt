"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import { slugify } from "@workspace/constants"
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
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { SubmitButton } from "@/components/submit-button"
import { type CreateOrgValues, makeCreateOrgSchema } from "@/lib/admin-schemas"

export function CreateOrganizationDialog() {
  const t = useTranslations("dashboard.admin.orgs.create")
  const tv = useTranslations("dashboard.validation")
  const createOrg = useMutation(api.platform.admin.createOrganization)
  const [open, setOpen] = useState(false)
  const [slugEdited, setSlugEdited] = useState(false)
  const [failed, setFailed] = useState(false)

  const schema = useMemo(() => makeCreateOrgSchema(tv), [tv])
  const form = useForm<CreateOrgValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", slug: "" },
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      form.reset()
      setSlugEdited(false)
      setFailed(false)
    }
  }

  async function onSubmit(values: z.output<typeof schema>) {
    setFailed(false)
    try {
      await createOrg(values)
      handleOpenChange(false)
    } catch {
      setFailed(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>{t("cta")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("nameLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        field.onChange(event)
                        // Auto-fill the slug from the name until the user edits
                        // the slug by hand.
                        if (!slugEdited) {
                          // Validate so the auto-filled slug counts toward
                          // form.formState.isValid (which gates the submit
                          // button); without this the button would stay disabled
                          // even with a valid name + derived slug.
                          form.setValue("slug", slugify(event.target.value), {
                            shouldValidate: true,
                          })
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("slugLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        field.onChange(event)
                        setSlugEdited(true)
                      }}
                    />
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
      </DialogContent>
    </Dialog>
  )
}
