/** Finds a PostgreSQL error code through the small wrapper chain used by ORM drivers. */
export function hasDatabaseErrorCode(
  error: unknown,
  expectedCode: string,
): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object") return false;
    if ("code" in current && current.code === expectedCode) return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}
