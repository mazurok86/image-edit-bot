export function defaultTo<V>(value: V | undefined, def: V): V {
  if (value === undefined) {
    return def
  }
  return value
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
