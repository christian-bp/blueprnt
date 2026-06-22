import { Hr, Text } from "@react-email/components"
import { emailMessages, fillTemplate } from "../messages"
import { colors } from "./theme"

export function Footer({ locale }: { locale: string }) {
  const m = emailMessages(locale).footer
  const year = String(new Date().getFullYear())
  return (
    <>
      <Hr
        className="mx-0 my-[26px] w-full"
        style={{ borderColor: colors.border }}
      />
      <Text
        className="m-0 text-center text-[12px] leading-[20px]"
        style={{ color: colors.muted }}
      >
        {fillTemplate(m.copyright, { year })}
      </Text>
      <Text
        className="m-0 text-center text-[12px] leading-[20px]"
        style={{ color: colors.muted }}
      >
        {m.tagline}
      </Text>
    </>
  )
}
