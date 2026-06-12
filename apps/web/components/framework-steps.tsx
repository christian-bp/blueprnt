import { useTranslations } from "next-intl"
import { cn } from "@workspace/ui/lib/utils"

// Per-card tone classes as full literals so Tailwind sees them at build
// time. Hovers are color-only (CLAUDE.md: no layout-shifting hover effects),
// so the variant's lift-and-shadow hover becomes a tone-matched border.
const STEPS = [
  {
    key: "factors",
    tile: "bg-rose-50 text-rose-500",
    hover: "hover:border-rose-200",
  },
  {
    key: "weighting",
    tile: "bg-emerald-50 text-emerald-500",
    hover: "hover:border-emerald-200",
  },
  {
    key: "structure",
    tile: "bg-amber-50 text-amber-500",
    hover: "hover:border-amber-200",
  },
] as const

export function FrameworkSteps() {
  const t = useTranslations("web.framework")

  return (
    <section id="framework" className="bg-surface py-24 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-2xl space-y-4">
            <h2 className="font-display font-extrabold text-4xl text-foreground tracking-tight md:text-5xl">
              {t("heading")}
            </h2>
            <p className="font-medium text-lg text-muted-foreground leading-relaxed">
              {t("lede")}
            </p>
          </div>
          <div className="whitespace-nowrap font-mono text-brand text-xs tracking-widest">
            {t("kicker")}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ key, tile, hover }) => (
            <div
              key={key}
              className={cn(
                "rounded-[2rem] border border-hairline bg-background p-10 shadow-sm transition-colors",
                hover
              )}
            >
              <div
                className={cn(
                  "mb-8 flex size-14 items-center justify-center rounded-2xl font-black",
                  tile
                )}
              >
                {t(`steps.${key}.step`)}
              </div>
              <h3 className="mb-4 font-bold font-display text-2xl text-foreground">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t(`steps.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
