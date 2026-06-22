import {
  Body,
  Container,
  Heading,
  Img,
  Preview,
  Section,
} from "@react-email/components"
import type React from "react"
import { emailMessages } from "../messages"
import { Footer } from "./footer"
import { colors, EmailThemeProvider, FONT_FAMILY, logoUrl } from "./theme"

export function BaseEmailTemplate({
  preview,
  title,
  locale,
  children,
}: {
  preview: string
  title?: React.ReactNode
  locale: string
  children: React.ReactNode
}) {
  const m = emailMessages(locale)
  return (
    <EmailThemeProvider lang={locale} preview={<Preview>{preview}</Preview>}>
      <Body
        className="mx-auto my-auto bg-white"
        style={{ fontFamily: FONT_FAMILY }}
      >
        <Container className="mx-auto my-[40px] max-w-[465px] px-[16px]">
          <Section className="mt-[32px]">
            <Img
              src={logoUrl()}
              width="140"
              height="36"
              alt={m.logoAlt}
              className="mx-auto my-0"
            />
          </Section>

          {title && (
            <Heading
              className="mx-0 my-[30px] p-0 text-center font-normal text-[24px]"
              style={{ color: colors.text }}
            >
              {title}
            </Heading>
          )}

          <Section>{children}</Section>

          <Footer locale={locale} />
        </Container>
      </Body>
    </EmailThemeProvider>
  )
}
