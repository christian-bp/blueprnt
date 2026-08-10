// The starter-set contract: the size limits every bulk role-creation path
// shares (the industry template, the AI starter import, the in-app role
// import). One definition for the whole stack, because these numbers are
// enforced in three places at once: the review's client gate, the sanitizer at
// the AI trust boundary, and the server's pre-write validation. When they
// drifted, the client happily submitted a payload the server rejected whole,
// leaving no way to find the offending row.
export const MAX_FAMILIES = 20
export const MAX_ROLES = 100
export const MAX_FAMILY_NAME = 100
export const MAX_ROLE_TITLE = 200
// The per-field cap on a role's job-profile texts (purpose, responsibilities).
// Shared for the same reason as the title cap: the create/edit forms gate on
// it client-side and the role mutations enforce it server-side.
export const MAX_ROLE_PROFILE_FIELD = 5000
