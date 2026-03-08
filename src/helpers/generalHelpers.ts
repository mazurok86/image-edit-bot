export function defaultTo<V>(value: V | undefined, def: V): V {
  if (value === undefined) {
    return def
  }
  return value
}
