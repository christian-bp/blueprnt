"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { type ReactNode, useEffect, useRef, useState } from "react"

// Guarantees the organization has its standard model before rendering children.
// The onboarding model step was removed, so the default model is seeded here on
// the way into the families step (which creates roles against it). By this point
// the country step has set the org language, so createModelFromTemplate picks
// the right locale. It creates exactly once: a ref guards the in-flight call and
// the null check stops once a model exists (the mutation also throws if one
// already does). Children render only once a model is present.
export function EnsureDefaultModel({
  orgId,
  children,
}: {
  orgId: string
  children: ReactNode
}) {
  const t = useTranslations("dashboard.model")
  const tOnboarding = useTranslations("dashboard.onboarding")
  const locale = useLocale()
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const createFromTemplate = useMutation(
    api.evaluationModel.model.createModelFromTemplate
  )
  const [failed, setFailed] = useState(false)
  const creatingRef = useRef(false)

  useEffect(() => {
    if (model === null && !creatingRef.current) {
      creatingRef.current = true
      createFromTemplate({ orgId }).catch(() => setFailed(true))
    }
  }, [model, orgId, createFromTemplate])

  if (model === undefined || model === null) {
    if (failed) {
      return (
        <main className="flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3">
            <p role="alert" className="text-destructive text-sm">
              {t("error")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFailed(false)
                creatingRef.current = true
                createFromTemplate({ orgId }).catch(() => setFailed(true))
              }}
            >
              {t("retry")}
            </Button>
          </div>
        </main>
      )
    }
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={tOnboarding("loading")} />
      </main>
    )
  }

  return <>{children}</>
}
