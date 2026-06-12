import { useTranslations } from "next-intl"
import { cn } from "@workspace/ui/lib/utils"

// Step order mirrors the product flow. Mono numbers rotate through the
// landing's rose/emerald/amber tones so the page reads as the same family,
// but the layout stays lighter than the landing cards: this page explains,
// it does not sell. Full literals so Tailwind sees them at build time.
const STEPS = [
  { key: "onboarding", tone: "text-rose-500" },
  { key: "model", tone: "text-emerald-500" },
  { key: "rating", tone: "text-amber-500" },
  { key: "bands", tone: "text-rose-500" },
  { key: "calibration", tone: "text-emerald-500" },
] as const

export function HowSteps() {
  const t = useTranslations("web.how")

  return (
    <section className="px-6 pt-16 pb-24 md:pt-24 md:pb-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 max-w-2xl space-y-4 md:mb-20">
          <h1 className="font-display font-extrabold text-5xl text-foreground leading-[1.05] tracking-tight md:text-6xl">
            {t("heading")}
          </h1>
          <p className="font-medium text-lg text-muted-foreground leading-relaxed md:text-xl">
            {t("lede")}
          </p>
        </div>

        <ol className="max-w-3xl divide-y divide-hairline border-hairline border-y">
          {STEPS.map(({ key, tone }) => (
            <li
              key={key}
              className="grid gap-x-10 gap-y-3 py-12 md:grid-cols-[4rem_1fr] md:py-14"
            >
              <div
                className={cn("pt-1.5 font-mono text-sm tracking-widest", tone)}
              >
                {t(`steps.${key}.step`)}
              </div>
              <div className="space-y-3">
                <h2 className="font-bold font-display text-2xl text-foreground md:text-3xl">
                  {t(`steps.${key}.title`)}
                </h2>
                <p className="max-w-xl text-muted-foreground leading-relaxed">
                  {t(`steps.${key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
