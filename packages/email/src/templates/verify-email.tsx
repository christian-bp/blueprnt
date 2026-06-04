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

export interface VerifyEmailProps {
  url: string
  locale: string
}

export function VerifyEmail({ url, locale }: VerifyEmailProps) {
  const m = emailMessages(locale).verifyEmail
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
