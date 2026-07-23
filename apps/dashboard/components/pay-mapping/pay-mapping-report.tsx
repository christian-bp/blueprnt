"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import { useTranslations } from "next-intl"

// The survey detail's Report tab: a placeholder until the signable summary,
// per-employee/action exports, and the EU Art. 9 filing land (out of scope
// for this pass; see the pay-mapping detail brief).
export function PayMappingReport() {
  const t = useTranslations("dashboard.payMapping.report")
  return (
    <Card>
      <CardContent className="space-y-2">
        <h3 className="font-medium text-sm">{t("comingSoonTitle")}</h3>
        <p className="text-muted-foreground text-sm">{t("comingSoonBody")}</p>
      </CardContent>
    </Card>
  )
}
