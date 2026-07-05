"use client"

import {
  UserAdd01Icon,
  UserCheck01Icon,
  UserEdit01Icon,
  UserMinus01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { NextButton } from "@/components/onboarding/next-button"
import { WizardFooter } from "@/components/onboarding/wizard-footer"
import { SuccessCheck } from "@/components/success-check"
import type { ImportResultCounts } from "./import-wizard"

// The final wizard screen: what the import actually did. The wizard reaches
// this only after importPayroll succeeded, so the only action is leaving.
export function ImportDoneStep({ result }: { result: ImportResultCounts }) {
  const t = useTranslations("dashboard.people.import.done")
  const router = useRouter()

  const rows = [
    { key: "created", icon: UserAdd01Icon, value: result.created },
    { key: "updated", icon: UserEdit01Icon, value: result.updated },
    { key: "unchanged", icon: UserCheck01Icon, value: result.unchanged },
    { key: "skipped", icon: UserMinus01Icon, value: result.skipped },
  ] as const

  return (
    <div className="flex w-full flex-col gap-6">
      {/* The shared celebratory check (same as 2FA setup and change email). */}
      <div className="flex justify-center">
        <SuccessCheck />
      </div>
      <div className="divide-y rounded-md border">
        {rows.map(({ key, icon, value }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-2 px-3 py-2"
            data-testid={`done-${key}`}
          >
            <span className="flex items-center gap-2">
              <HugeiconsIcon
                icon={icon}
                strokeWidth={2}
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-sm">{t(key)}</span>
            </span>
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
