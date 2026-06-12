import { useTranslations } from "next-intl"

const ITEMS = ["equalWork", "equalValue", "directive"] as const

export function ComplianceBand() {
  const t = useTranslations("web.compliance")

  return (
    <section id="compliance" className="py-24 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col justify-between rounded-[2.5rem] bg-brand p-10 text-brand-foreground shadow-2xl shadow-rose-200 md:p-12">
            <div
              aria-hidden
              className="mb-12 flex size-12 items-center justify-center rounded-xl bg-brand-foreground/20 backdrop-blur-md"
            >
              <svg
                aria-hidden="true"
                className="size-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="mb-6 font-display font-extrabold text-2xl leading-tight md:text-3xl">
                {t("title")}
              </h2>
              <p className="mb-8 text-brand-foreground/80 leading-relaxed">
                {t("body")}
              </p>
              <ul className="space-y-3">
                {ITEMS.map((key) => (
                  <li
                    key={key}
                    className="flex items-center gap-3 font-semibold text-sm"
                  >
                    <span className="size-2 shrink-0 rounded-full bg-brand-foreground" />
                    {t(`items.${key}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-[2.5rem] bg-pop p-12 text-center text-pop-foreground">
            <div className="mb-3 font-black font-display text-7xl tracking-tight md:text-8xl">
              {t("statValue")}
            </div>
            <div className="font-bold text-xs uppercase tracking-[0.3em] opacity-80">
              {t("statLabel")}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
