export function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []

  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }

  return result
}

export function recordToEntries<T extends Record<string, unknown>>(record: T): { [K in keyof T]: [K, T[K]] }[keyof T][] {
  return Object.entries(record) as { [K in keyof T]: [K, T[K]] }[keyof T][]
}
