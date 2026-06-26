import { Section, Text } from "@react-email/components"
import { BaseEmailTemplate } from "../components/base-email"
import { colors } from "../components/theme"
import { emailMessages } from "../messages"

export interface TwoFactorCodeEmailProps {
  code: string
  email: string
  locale: string
}

export function TwoFactorCodeEmail({ code, locale }: TwoFactorCodeEmailProps) {
  const m = emailMessages(locale).twoFactorCode
  return (
    <BaseEmailTemplate preview={m.heading} title={m.heading} locale={locale}>
      <Text
        className="m-0 text-[16px] leading-[26px]"
        style={{ color: colors.text }}
      >
        {m.body}
      </Text>
      <Section className="my-[32px] text-center">
        <Text
          className="m-0 inline-block rounded-[8px] bg-[#f5f5f5] px-[28px] py-[18px] text-center font-mono text-[30px] font-bold tracking-[8px]"
          style={{ color: colors.text }}
        >
          {code}
        </Text>
      </Section>
      <Text
        className="m-0 text-[14px] leading-[22px]"
        style={{ color: colors.muted }}
      >
        {m.note}
      </Text>
    </BaseEmailTemplate>
  )
}

TwoFactorCodeEmail.PreviewProps = {
  code: "123456",
  email: "user@example.com",
  locale: "en",
} satisfies TwoFactorCodeEmailProps

export default TwoFactorCodeEmail
