import { useTranslations } from "next-intl"
import { Reveal } from "@/components/reveal"

const STEPS = ["contact", "walkthrough", "handshake", "start"] as const

export function Approach() {
  const t = useTranslations("web.approach")

  return (
    <section id="approach" className="py-24 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-14 max-w-2xl space-y-3">
          <h2 className="font-display font-extrabold text-4xl text-foreground tracking-tight md:text-5xl">
            {t("heading")}
          </h2>
          <p className="text-lg text-muted-foreground">{t("lede")}</p>
        </Reveal>

        <Reveal
          delay={0.08}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {STEPS.map((key) => (
            <div
              key={key}
              className="rounded-3xl border border-hairline bg-background p-8 shadow-sm transition-colors hover:border-brand/30"
            >
              <div className="mb-6 font-mono text-[10px] text-muted-foreground/60 tracking-widest">
                {t(`steps.${key}.label`)}
              </div>
              <h3 className="mb-3 font-bold font-display text-foreground text-xl">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t(`steps.${key}.body`)}
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
