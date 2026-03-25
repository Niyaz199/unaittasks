export type RelationValue<T> = T | T[] | null;
export type RelationInput<T> = RelationValue<T> | undefined;

export type NamedRelation = RelationValue<{ name: string }>;

export function unwrapRelation<T>(value: RelationInput<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function resolveRelationName<T extends { name: string }>(value: RelationInput<T>, fallback = "—") {
  return unwrapRelation(value)?.name ?? fallback;
}

export function resolveRelationNameWithFallback<T extends { name: string }>(
  value: RelationInput<T>,
  fallback: string | null,
  emptyValue = "—"
) {
  return unwrapRelation(value)?.name ?? fallback ?? emptyValue;
}
