import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// A conversation's title has the same bound as the AI-generated one it can
// replace (ASSISTANT_TITLE_MAX_LENGTH, packages/backend/convex/ai/config.ts),
// mirrored here as a plain literal: the schema file is client-only and never
// imports the backend package.
const RENAME_CONVERSATION_MAX_LENGTH = 60

export function makeRenameConversationSchema(t: ValidationT) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, t("required"))
      .max(RENAME_CONVERSATION_MAX_LENGTH, t("maxLength")),
  })
}
export type RenameConversationValues = z.infer<
  ReturnType<typeof makeRenameConversationSchema>
>
