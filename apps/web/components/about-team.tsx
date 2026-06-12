import { useTranslations } from "next-intl"

// The three team cards. Keys are declared as a const so Tailwind sees the
// full class strings at build time (no dynamic string concat).
// Avatar initials are derived from the first character of each name key so
// we never hardcode display characters in logic.
const MEMBERS = ["founders", "development", "success"] as const

export function AboutTeam() {
  const t = useTranslations("web.about.team")

  return (
    <section className="border-hairline border-b py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 max-w-2xl">
          <h2 className="mb-4 font-display text-4xl tracking-tight">
            {t("heading")}
          </h2>
          <p className="text-lg text-muted-foreground">{t("lede")}</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {MEMBERS.map((key) => {
            const name = t(`members.${key}.name`)
            return (
              <div key={key} className="rounded-2xl bg-surface p-8">
                {/* Avatar: a fixed-size circle with the member's initial in brand color. */}
                <div className="mb-6 flex size-16 items-center justify-center rounded-full border border-hairline bg-background">
                  <span className="font-bold text-2xl text-brand" aria-hidden>
                    {name.charAt(0)}
                  </span>
                </div>

                <h3 className="mb-1 font-display text-xl tracking-tight">
                  {name}
                </h3>
                <div className="mb-4 font-medium text-brand text-sm">
                  {t(`members.${key}.role`)}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(`members.${key}.bio`)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
