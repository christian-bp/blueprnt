import { useTranslations } from "next-intl"

const CARDS = ["start", "implementation", "independence", "exit"] as const

export function ModelUsp() {
  const t = useTranslations("web.model")

  return (
    <section id="model" className="py-24 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-accent px-4 py-1.5 font-extrabold text-[11px] text-brand uppercase tracking-[0.2em]">
              <span className="size-1.5 rounded-full bg-brand" />
              {t("badge")}
            </div>
            <h2 className="font-display font-extrabold text-4xl text-foreground leading-tight tracking-tight md:text-5xl">
              {t("titleLead")}{" "}
              <span className="text-brand">{t("titleAccent")}</span>{" "}
              {t("titleTail")}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("lede")}
            </p>
          </div>
          <div className="whitespace-nowrap font-mono text-brand text-xs tracking-widest">
            {t("kicker")}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {CARDS.map((key) => (
            <div
              key={key}
              className="rounded-3xl border border-hairline bg-surface p-10 transition-colors hover:border-brand/30 hover:bg-background"
            >
              <div className="mb-4 font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                {t(`cards.${key}.label`)}
              </div>
              <h3 className="mb-3 font-bold font-display text-foreground text-xl">
                {t(`cards.${key}.title`)}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t(`cards.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
