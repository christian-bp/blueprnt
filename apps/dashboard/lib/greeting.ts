// Time-of-day bucket for the front-page welcome greeting. Boundaries match the
// midday reference: morning 5-11, afternoon 12-16, evening 17-4. Pure so it is
// deterministic and unit-tested; the component supplies the browser-local hour.
export type GreetingBucket = "morning" | "afternoon" | "evening"

export function greetingBucket(hour: number): GreetingBucket {
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "afternoon"
  return "evening"
}
