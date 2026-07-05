"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { NextButton } from "@/components/onboarding/next-button"
import { WizardFooter } from "@/components/onboarding/wizard-footer"
import type { ImportResultCounts } from "./import-wizard"

// The final wizard screen: what the import actually did. The wizard reaches
// this only after importPayroll succeeded, so the only action is leaving.
export function ImportDoneStep({ result }: { result: ImportResultCounts }) {
  const t = useTranslations("dashboard.people.import.done")
  const router = useRouter()

  const rows = [
    { key: "created", value: result.created },
    { key: "updated", value: result.updated },
    { key: "unchanged", value: result.unchanged },
    { key: "skipped", value: result.skipped },
  ] as const

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="divide-y rounded-md border">
        {rows.map(({ key, value }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-2 px-3 py-2"
            data-testid={`done-${key}`}
          >
            <span className="text-sm">{t(key)}</span>
            <span className="font-medium font-mono text-sm">{value}</span>
          </div>
        ))}
      </div>
      <WizardFooter>
        <NextButton
          label={t("goToPeople")}
          onClick={() => router.push("/people")}
          data-testid="go-to-people"
        />
      </WizardFooter>
    </div>
  )
}
