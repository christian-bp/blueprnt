import { criteriaLibraryContent } from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import da from "@workspace/i18n/messages/da.json"
import en from "@workspace/i18n/messages/en.json"
import fi from "@workspace/i18n/messages/fi.json"
import nb from "@workspace/i18n/messages/nb.json"
import sv from "@workspace/i18n/messages/sv.json"
import { describe, expect, it } from "vitest"

// THE SHARED SCALE IS STORED TWICE, and the two copies must say one thing.
//
// The library module carries it because a criterion's anchors are rendered
// from the library and the scale frames them; the message files carry it
// because the rating stepper labels every step and explains it in the scale's
// own help. Neither can read the other at its own call site: the stepper is a
// client component reading i18n, and the library is what the backend hands the
// rating wire.
//
// Nothing compared them until now, and they had split: the English grade 1 was
// "Bounded requirement" in the library and "Defined requirement" in the
// messages, and grade 5 disagreed too, while Finnish disagreed on grades 2 and
// 4. A reader met one wording on the step and the other in the docs page that
// quotes them. This is the cheap guard that keeps one wording per grade.
const MESSAGES = { en, sv, nb, da, fi } as const
const STEPS = ["1", "2", "3", "4", "5"] as const

describe("the shared scale's two copies", () => {
  it.each(Object.keys(MESSAGES) as (keyof typeof MESSAGES)[])(
    "%s says one thing on every grade",
    (locale) => {
      const library = criteriaLibraryContent(locale).sharedScale
      const scale = MESSAGES[locale].dashboard.rating.scale
      for (const step of STEPS) {
        const message = scale[`step${step}` as const]
        expect(message.name, `${locale} step${step} name`).toBe(
          library[step].name
        )
        expect(message.meaning, `${locale} step${step} meaning`).toBe(
          library[step].meaning
        )
      }
    }
  )
})
