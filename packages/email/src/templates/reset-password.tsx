import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components"
import { emailMessages } from "../messages"

export interface ResetPasswordEmailProps {
  url: string
  locale: string
}

export function ResetPasswordEmail({ url, locale }: ResetPasswordEmailProps) {
  const m = emailMessages(locale).resetPassword
  return (
    <Html lang={locale}>
      <Preview>{m.subject}</Preview>
      <Body>
        <Container>
          <Heading>{m.heading}</Heading>
          <Text>{m.body}</Text>
          <Button href={url}>{m.cta}</Button>
        </Container>
      </Body>
    </Html>
  )
}
