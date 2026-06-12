import { useTranslations } from "next-intl"
import { Reveal } from "@/components/reveal"
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

function StepCard({
  step,
  t,
  className,
  titleClassName,
}: {
  step: (typeof STEPS)[number]
  t: ReturnType<typeof useTranslations<"web.framework">>
  className?: string
  titleClassName?: string
}) {
  const { key, tile, hover } = step
  return (
    <div
      className={cn(
        "rounded-[2rem] border border-hairline bg-background p-10 shadow-sm transition-colors",
        hover,
        className
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
      <h3
        className={cn(
          "mb-4 font-bold font-display text-2xl text-foreground",
          titleClassName
        )}
      >
        {t(`steps.${key}.title`)}
      </h3>
      <p className="text-muted-foreground leading-relaxed">
        {t(`steps.${key}.body`)}
      </p>
    </div>
  )
}

export function FrameworkSteps() {
  const t = useTranslations("web.framework")

  return (
    <section id="framework" className="bg-surface py-24 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-16 max-w-2xl space-y-4">
          <h2 className="font-display font-extrabold text-4xl text-foreground tracking-tight md:text-5xl">
            {t("heading")}
          </h2>
          <p className="font-medium text-lg text-muted-foreground leading-relaxed">
            {t("lede")}
          </p>
        </Reveal>

        {/* Asymmetric 3-step composition (1 large + 2 stacked) instead of
            three identical columns; same tones and copy, mobile collapses to
            a single column. */}
        <Reveal delay={0.08}>
          <div className="grid gap-6 md:grid-cols-5">
            <StepCard
              step={STEPS[0]}
              t={t}
              className="md:col-span-3 md:p-12"
              titleClassName="md:text-3xl"
            />
            <div className="grid gap-6 md:col-span-2">
              <StepCard step={STEPS[1]} t={t} />
              <StepCard step={STEPS[2]} t={t} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
