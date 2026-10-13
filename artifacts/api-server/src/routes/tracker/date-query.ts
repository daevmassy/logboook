export function normalizeDateOnlyQuery(
  query: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  const normalized: Record<string, unknown> =
    query && typeof query === "object" && !Array.isArray(query)
      ? { ...(query as Record<string, unknown>) }
      : {};

  for (const field of fields) {
    const value = normalized[field];
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      continue;
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    ) {
      normalized[field] = date;
    }
  }

  return normalized;
}
