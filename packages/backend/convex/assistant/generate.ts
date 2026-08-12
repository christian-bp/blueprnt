"use node"

import { stepCountIs, streamText } from "ai"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import { internalAction } from "../_generated/server"
import {
  AI_ASSISTANT_MODEL_ID,
  AI_PROVIDER,
  ASSISTANT_FLUSH_INTERVAL_MS,
  ASSISTANT_MAX_TOOL_STEPS,
} from "../ai/config"
import { aiModel } from "../ai/provider"
import { ERROR_CODES } from "../lib/errors"
import { assistantSystemPrompt } from "./knowledge"
import type { AssistantMessagePart } from "./tables"
import { buildAssistantTools, VISUAL_TOOL_CHARTS } from "./tools"

export const generateAssistantReply = internalAction({
  args: {
    assistantMessageId: v.id("assistantMessages"),
    threadId: v.id("assistantThreads"),
    orgId: v.string(),
    userId: v.string(),
    locale: v.string(),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Parts accumulate as the stream progresses: completed parts plus the
    // text part currently being streamed. snapshot() is what gets flushed.
    const done: AssistantMessagePart[] = []
    let currentText = ""
    const snapshot = (): AssistantMessagePart[] =>
      currentText === ""
        ? [...done]
        : [...done, { type: "text", text: currentText }]

    const finalize = (
      status: "complete" | "failed" | "stopped",
      errorCode?: string
    ) =>
      ctx.runMutation(internal.assistant.chat.finalizeReply, {
        messageId: args.assistantMessageId,
        status,
        parts: snapshot(),
        ...(errorCode !== undefined ? { errorCode } : {}),
      })

    const model = aiModel(AI_ASSISTANT_MODEL_ID)
    if (model === null) {
      await finalize("failed", ERROR_CODES.aiUnavailable)
      return null
    }

    const history = await ctx.runQuery(
      internal.assistant.chat.getGenerationContext,
      { threadId: args.threadId }
    )

    // Input-side PII screen (ADR-0018): if the message the user just sent
    // carries an employee's full name, no AI call happens at all. The reply
    // fails with a specific code the UI translates into "remove the personal
    // details", and no usage row is written (no tokens were consumed).
    const lastUser = [...history].reverse().find((m) => m.role === "user")
    if (lastUser !== undefined) {
      const flagged = await ctx.runQuery(
        internal.assistant.insights.containsEmployeeName,
        { orgId: args.orgId, text: lastUser.text }
      )
      if (flagged) {
        await finalize("failed", ERROR_CODES.assistantPersonalData)
        return null
      }
    }

    const controller = new AbortController()
    let stopped = false
    try {
      const result = streamText({
        model,
        abortSignal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(120_000),
        ]),
        system: assistantSystemPrompt({
          locale: args.locale,
          ...(args.industry !== undefined ? { industry: args.industry } : {}),
          ...(args.country !== undefined ? { country: args.country } : {}),
          ...(args.employeeCount !== undefined
            ? { employeeCount: args.employeeCount }
            : {}),
        }),
        messages: history.map((m) => ({ role: m.role, content: m.text })),
        tools: buildAssistantTools(ctx, { orgId: args.orgId }),
        stopWhen: stepCountIs(ASSISTANT_MAX_TOOL_STEPS),
      })

      // Every generation that consumed tokens gets a usage row, including
      // stopped ones: on abort the SDK's usage promise may reject or never
      // settle, so it is raced against a short timeout and the row is only
      // skipped when the provider reported nothing. Defined before the loop
      // because the abort branch below (a user-requested stop) also needs
      // it, matching the fall-through complete/stopped path.
      const recordUsage = async () => {
        try {
          const usage = await Promise.race([
            result.usage,
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 2_000)
            ),
          ]).catch(() => null)
          if (usage === null) {
            console.error("assistant usage unavailable after stop", {
              messageId: args.assistantMessageId,
            })
            return
          }
          await ctx.runMutation(internal.ai.usage.recordAiUsageDirect, {
            orgId: args.orgId,
            kind: "assistant.chat",
            provider: AI_PROVIDER,
            model: AI_ASSISTANT_MODEL_ID,
            actorId: args.userId,
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            totalTokens: usage.totalTokens ?? 0,
            cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
          })
        } catch (error) {
          console.error("assistant usage recording failed", {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      let lastFlush = 0
      const flush = async (): Promise<boolean> => {
        const stopRequested = await ctx.runMutation(
          internal.assistant.chat.updateParts,
          { messageId: args.assistantMessageId, parts: snapshot() }
        )
        if (stopRequested) {
          stopped = true
          controller.abort()
        }
        return stopRequested
      }

      // Part type names and fields verified against node_modules/ai@7.0.51's
      // dist/index.d.ts (the bundled docs describe an older shape for the
      // `stream`/`fullStream` union): a text-delta part carries `text`; a
      // tool-result part carries `toolName` (widens to `string` because the
      // union also includes the dynamic-tool branch) and `output` (typed
      // `unknown` for the same reason, so it is narrowed defensively below
      // rather than cast). `stream` is the current, non-deprecated property
      // (`fullStream` is `@deprecated Use stream instead`, identical type).
      // The SDK does NOT throw on abort or on a non-fatal error: it enqueues
      // an `{ type: "abort" }` or `{ type: "error", error }` part and closes
      // the stream gracefully (dist/index.js's `pull`/`eventProcessor`), so
      // both are handled here, not in the catch block below.
      for await (const part of result.stream) {
        if (part.type === "text-delta") {
          currentText += part.text
          const now = Date.now()
          if (now - lastFlush >= ASSISTANT_FLUSH_INTERVAL_MS) {
            lastFlush = now
            if (await flush()) break
          }
        } else if (part.type === "tool-result") {
          const chart = VISUAL_TOOL_CHARTS[part.toolName]
          if (chart !== undefined) {
            if (currentText !== "") {
              done.push({ type: "text", text: currentText })
              currentText = ""
            }
            done.push({
              type: "chart",
              chart,
              summary:
                typeof part.output === "object" &&
                part.output !== null &&
                "summary" in part.output &&
                typeof part.output.summary === "string"
                  ? part.output.summary
                  : "",
            })
            if (await flush()) break
          }
        } else if (part.type === "abort") {
          // `stopped` is only ever set by our own flush() reporting a
          // user-requested stop. Any OTHER abort (the 120s timeout leg of
          // the AbortSignal.any race) reaches here with `stopped` still
          // false, which is a failure, not a user stop.
          if (stopped) {
            await finalize("stopped")
            await recordUsage()
            return null
          }
          console.error("assistant stream aborted without a user stop", {
            messageId: args.assistantMessageId,
            reason: part.reason,
          })
          await finalize("failed", ERROR_CODES.aiGenerationFailed)
          return null
        } else if (part.type === "error") {
          console.error("assistant stream reported an error part", {
            messageId: args.assistantMessageId,
            error:
              part.error instanceof Error
                ? part.error.message
                : String(part.error),
          })
          await finalize("failed", ERROR_CODES.aiGenerationFailed)
          return null
        }
      }

      // A blank successful bubble is a lie (and getGenerationContext's
      // empty-parts filter would hide it from the model on the next turn
      // anyway): reachable when the tool-step budget is exhausted with no
      // prose step left, so treat it as a failure instead of "complete".
      if (!stopped && done.length === 0 && currentText === "") {
        await finalize("failed", ERROR_CODES.aiGenerationFailed)
        return null
      }

      await finalize(stopped ? "stopped" : "complete")
      await recordUsage()
      return null
    } catch (error) {
      if (stopped) {
        await finalize("stopped")
        return null
      }
      console.error("assistant generation failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      await finalize("failed", ERROR_CODES.aiGenerationFailed)
      return null
    }
  },
})
