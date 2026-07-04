// Pure name-display decision for the pseudonymizeNames org toggle. The stored
// displayName is never mutated; this only chooses what the UI renders. Falls
// back to the real name when there is no externalRef to build a pseudonym from.
export function displayNameFor(
  person: { displayName: string; externalRef: string | null },
  pseudonymize: boolean,
  pseudonymTemplate: (ref: string) => string
): string {
  if (pseudonymize && person.externalRef !== null) {
    return pseudonymTemplate(person.externalRef)
  }
  return person.displayName
}
