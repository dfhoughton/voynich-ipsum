import { pickMe, Rng } from 'pick-me-too'

export class Hmm {
  public rng: Rng
  constructor(rng: Rng) {
    this.rng = rng
  }

  public n(): number {
    return this.rng()
  }

  public maybe(threshold: number = 0.5): boolean {
    return this.rng() <= threshold
  }

  public fromRange(low: number, high: number): number {
    if (low === high) return low
    if (low > high) throw new Error(`low (${low}) should be less than or equal to high (${high})`)
    return low + (high - low) * this.n()
  }
}

export function dupParams<T>(t: T): T {
  if (Array.isArray(t)) return t.map((o) => dupParams(o)) as any as T
  if (typeof t === 'object') {
    const rv: any = {}
    for (const [k, v] of Object.entries(t)) {
      rv[k] = dupParams(v)
    }
    return rv as T
  }
  return t
}

export function pickN<T>(n: number, picker: () => T): T[] {
  const seen: Set<T> = new Set()
  while (seen.size < n) seen.add(picker())
  return Array.from(seen)
}

// exhaustiveness checker
export function assertNever(x: never): never {
  console.error(x)
  throw new Error('Unexpected object: ' + x)
}

// for cloning simple structs
export function simpleClone<T>(t: T): T {
  switch (typeof t) {
    case 'undefined':
    case 'number':
    case 'boolean':
      return t
    case 'string':
      return ('' + t) as any as T
    default:
      if (null === t) return t
      if (Array.isArray(t)) {
        return t.map((v) => simpleClone(v)) as any as T
      }
      const obj: any = {}
      for (const [k, v] of Object.entries(t)) {
        obj[k] = simpleClone(v)
      }
      return obj as T
  }
}

// remove nullish things from an array
export function compact<T>(ar: (T | null | undefined)[]): T[] {
  const compacted: T[] = []
  for (const t of ar) {
    if (t != null) compacted.push(t)
  }
  return compacted
}

// turns [[1, 2], [3, 4], [5, 6]] into
// [[1, 3, 5], [1, 3, 6], [1, 4, 5], [1, 4, 6], [2, 3, 5], [2, 3, 6], [2, 4, 5], [2, 4, 6]]
export function combinations<T>(parts: T[][]): T[][] {
  if (parts.length === 1) return parts[0].map((v) => [v])
  const [head, ...tail] = parts
  const combos: T[][] = []
  const tailCombos = combinations(tail)
  for (const t of head) {
    for (const rest of tailCombos) {
      combos.push([t].concat(rest))
    }
  }
  return combos
}

// turns [1, 2, 3] into
// [[1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]] (not in this order)
export function subsets<T>(options: T[]): T[][] {
  if (options.length === 0) return []
  const [head, ...tail] = options
  const rv: T[][] = []
  const subsubset = subsets(tail)
  rv.push([head])
  for (const ss of subsubset) {
    rv.push(ss)
    rv.push([head, ...ss])
  }
  return rv
}

// mechanism to filter duplicates from a list
export function uniqBy<T, K>(ar: T[], test: (t: T) => K): T[] {
  const seen: Set<K> = new Set()
  const copy: T[] = []
  for (const t of ar) {
    const k = test(t)
    if (seen.has(k)) continue
    seen.add(k)
    copy.push(t)
  }
  return copy
}

// see https://stackoverflow.com/a/2450976
export function shuffle<T>(array: T[], rng: Rng) {
  let currentIndex = array.length,
    randomIndex
  while (currentIndex != 0) {
    randomIndex = Math.floor(rng() * currentIndex)
    currentIndex--
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
  }
  return array
}


export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function titleize(s: string): string {
  return s.split(/(\s+)/).map(s => capitalize(s)).join('')
}