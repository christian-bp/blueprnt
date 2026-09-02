// Upper bound on the people one archive write may touch: the register's
// bulk action and the payroll import both archive leavers in chunks of this
// size (one transaction per chunk), so a large org's leavers never ride one
// unbounded mutation. Shared here so the client loop and the backend bound
// can never drift apart.
export const PEOPLE_ARCHIVE_CHUNK_SIZE = 50
