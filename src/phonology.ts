import { pickMe, pickMeToo, Rng } from 'pick-me-too'
import { assertNever, combinations, compact, Hmm, pickN, uniqBy } from './util'

export type Phonology = {
  closedSyllables?: boolean
  consonantClusters?: { initial?: boolean; final?: boolean }
  vowels?: {
    vocalicSyllableNuclei?: string[]
    nonVocalicSyllableNuclei?: string[]
    vowelComplexity?: VowelComplexity
    longVowels?: boolean
  }
  consonants?: {
    placesOfArticulation?: PlaceOfArticulation[]
    voicingMechanisms?: Voicing[]
    mayHaveFricatives?: boolean
    mayHaveAffricates?: boolean
    mayHaveNasals?: boolean
    mayHaveApproximants?: boolean
    stops?: string[]
    fricatives?: string[]
    affricates?: string[]
    nasals?: string[]
    approximants?: string[]
  }
  /**
   * A record generated from the paramters above.
   */
  numberPossibleSyllables?: number
}

type phonemeGenerator = () => string

type VowelComplexity = 'minimal' | 'simple' | 'canonical' | 'complex'

/**
 * Something that picks the syllables that may appear in a language -- the consonants,
 * vowels, and their arrangement.
 * 
 * There is a great deal of phonology that is ignored by this engine. There are no tones,
 * vowel harmony, mutations, nasal vowels, and on and on and on. But it's a start.
 */
export class PhonologyEngine {
  private phonology: Phonology
  private syllableGenerator: () => string
  /**
   * Creates an instance of phonology engine.
   * @param [p] - optional configuration
   * @param [rng] - a random number generator for picking configuration parameters that are not supplied and then making syllables
   */
  constructor(p: Phonology = {}, rng: Rng = () => Math.random()) {
    this.phonology = p
    const h = new Hmm(rng)
    const [nucleus, nucleusCombinations] = pickVowels(p, rng, h)
    const [onset, coda, onsetCombinations, codaCombinations] = pickConsonants(p, rng, h)
    p.numberPossibleSyllables = onsetCombinations * nucleusCombinations * codaCombinations
    this.syllableGenerator = () => onset() + nucleus() + coda()
  }
  /**
   * Provides the configuration parameters used by the engine.
   * 
   * This configuration should be read-only. In any case, changing it will have no effect on
   * the behavior of the engine, since configuration parameters are only consulted during initialization.
   * 
   * If you find a language whose sound you like, you can use this to obtain its configuration and
   * then copy it to other languages.
   * 
   * @returns configuration parameters 
   */
  config(): Readonly<Phonology> {
    return this.phonology
  }
  /**
   * Generates a random syllable.
   * 
   * @returns syllable 
   */
  syllable(): string {
    return this.syllableGenerator()
  }
}

const vowelComplexityPicker = pickMeToo<VowelComplexity>([
  ['minimal', 1],
  ['simple', 5],
  ['canonical', 100],
  ['complex', 30],
])

const minimalVowelPicker = pickMeToo([
  ['a', 20],
  ['o', 2],
  ['e', 2],
  ['u', 1],
  ['i', 1],
])

const simpleVowelPicker = pickMeToo([
  [['a', 'i', 'u'], 10],
  [['a', 'e', 'i', 'u'], 1],
  [['a', 'o', 'i', 'u'], 1],
]) as any as (rng: Rng) => () => string[]

const complexCountPicker = pickMeToo([
  [6, 1],
  [7, 2],
  [8, 3],
  [9, 4],
  [10, 5],
  [11, 6],
  [12, 7],
  [13, 8],
  [14, 9],
  [15, 10],
  [16, 11],
  [17, 11],
])

const complexVowelPicker = pickMeToo([
  ['a', 1000],
  ['ai', 100],
  ['au', 100],
  ['e', 1000],
  ['eu', 90],
  ['eo', 10],
  ['i', 1000],
  ['iu', 100],
  ['o', 1000],
  ['oi', 100],
  ['ou', 100],
  ['u', 1000],
  ['ui', 100],
  ['uo', 100],
  ['ue', 100],
  ['y', 500],
  ['yi', 50],
  ['yø', 50],
  ['ö', 500],
  ['öy', 50],
  ['öi', 50],
  ['ë', 500], // ɛ
  ['ëi', 50],
  ['ëu', 50],
  ['ä', 300],
  ['äi', 30],
  ['äu', 30],
])

const nonVocalicNucleusCountPicker = pickMeToo([
  [1, 15],
  [2, 10],
  [3, 4],
  [4, 3],
  [5, 2],
  [6, 2],
  [7, 1],
])

const nonVocalicFrequencies: [string, number][] = [
  ['m', 10],
  ['n', 10],
  ['v', 1],
  ['f', 0.5],
  ['z', 1],
  ['s', 0.5],
  ['h', 0.25],
  ['r', 10],
  ['l', 10],
]

const nonVocalicNucleusPicker = pickMeToo(nonVocalicFrequencies)

const nonVocalicNuclei = new Set(nonVocalicFrequencies.map(([s]) => s))

function pickVowels(p: Phonology, rng: () => number, h: Hmm): [phonemeGenerator, number] {
  const v = p.vowels ?? {}
  p.vowels = v
  if (!v.vocalicSyllableNuclei) {
    v.vowelComplexity ??= vowelComplexityPicker(rng)()
    let nuclei: string[] = []
    switch (v.vowelComplexity) {
      case 'minimal':
        nuclei.push(minimalVowelPicker(rng)())
        break
      case 'simple':
        nuclei.push(...simpleVowelPicker(rng)())
        break
      case 'canonical':
        nuclei = ['a', 'e', 'i', 'o', 'u']
        break
      case 'complex':
        nuclei.push(...pickN(complexCountPicker(rng)(), complexVowelPicker(rng)))
        break
      default:
        assertNever(v.vowelComplexity)
    }
    v.vocalicSyllableNuclei = nuclei
  }
  if (!v.nonVocalicSyllableNuclei && h.maybe(0.02)) {
    v.nonVocalicSyllableNuclei = pickN(nonVocalicNucleusCountPicker(rng)(), nonVocalicNucleusPicker(rng))
  } else {
    v.nonVocalicSyllableNuclei = []
  }
  const vowelFrequencies = v.vocalicSyllableNuclei
    .map((s) => [s, rng() * 3])
    .concat(v.nonVocalicSyllableNuclei.map((s) => [s, rng()])) as any as [string, number][]
  v.longVowels ??= h.maybe(0.3)
  const nucleusPicker = pickMe(vowelFrequencies, rng)
  let picker,
    combinations = vowelFrequencies.length
  if (v.longVowels) {
    const longVowelProbability = h.fromRange(0.05, 0.5)
    if (v.nonVocalicSyllableNuclei.length) {
      for (const [v] of vowelFrequencies) {
        if (v.length === 1 && !nonVocalicNuclei.has(v)) combinations++
      }
      picker = () => {
        const s = nucleusPicker()
        if (s.length == 2 || nonVocalicNuclei.has(s) || rng() > longVowelProbability) return s
        return s + s
      }
    } else {
      for (const [v] of vowelFrequencies) {
        if (v.length === 1) combinations++
      }
      picker = () => {
        const s = nucleusPicker()
        if (s.length == 2 || rng() > longVowelProbability) return s
        return s + s
      }
    }
  } else {
    picker = nucleusPicker
  }
  return [picker, vowelFrequencies.length]
}

type PlaceOfArticulation = 'labial' | 'dental' | 'aveolar' | 'palatal' | 'velar' | 'uvular' | 'glottal'

const placeOfArticulationPicker: (rng: Rng) => () => PlaceOfArticulation = pickMeToo([
  ['labial', 1500],
  ['dental', 600],
  ['aveolar', 2000],
  ['palatal', 500],
  ['velar', 1500],
  ['uvular', 300],
  ['glottal', 1000],
]) as any as (rng: Rng) => () => PlaceOfArticulation

const placeOfArticulationCountPicker = pickMeToo([
  [2, 10],
  [3, 150],
  [4, 200],
  [5, 50],
  [6, 3],
  [7, 1],
])

const consonants: Record<PlaceOfArticulation, any> = {
  labial: {
    stops: {
      voiced: ['b'],
      unvoiced: ['p'],
    },
    fricatives: {
      voiced: ['v'],
      unvoiced: ['f'],
    },
    affricates: {
      voiced: ['bv'],
      unvoiced: ['pf'],
    },
    nasals: ['m'],
    approximant: ['w'],
  },
  dental: {
    fricatives: {
      voiced: ['θ'],
      unvoiced: ['dh'],
    },
    affricates: {
      voiced: ['ddh'],
      unvoiced: ['tθ'],
    },
  },
  aveolar: {
    stops: {
      voiced: ['d'],
      unvoiced: ['t'],
      aspirated: ['th'],
      ejective: ["t'"],
    },
    fricatives: {
      voiced: ['z'],
      unvoiced: ['s', 'll'],
    },
    affricates: {
      voiced: ['dz'],
      unvoiced: ['ts', 'tll'],
      ejective: ["ts'", "tll'"],
    },
    nasals: ['n'],
    approximant: ['r', 'l'],
  },
  palatal: {
    stops: {
      unvoiced: ['c'],
      aspirated: ['ch'],
      ejective: ["c'"],
    },
    nasals: ['ñ'],
    approximant: ['j'],
  },
  velar: {
    stops: {
      voiced: ['g'],
      unvoiced: ['k'],
      aspirated: ['kh'],
      ejective: ["k'"],
    },
    fricatives: {
      voiced: ['x'],
      unvoiced: ['gh'],
    },
    affricates: {
      voiced: ['kx'],
      ejective: ["kx'"],
    },
    nasals: ['ng'],
  },
  uvular: {
    stops: {
      unvoiced: ['q'],
    },
  },
  glottal: {
    stops: {
      unvoiced: ["'"],
    },
    fricatives: {
      unvoiced: ['h'],
    },
  },
} as const

type Voicing = 'voiced' | 'unvoiced' | 'aspirated' | 'ejective'

const voicingMechanismPicker: (rng: Rng) => () => Voicing = pickMeToo([
  ['voiced', 1500],
  ['unvoiced', 2000],
  ['aspirated', 500],
  ['ejective', 50],
]) as any as (rng: Rng) => () => Voicing

const voicingMechanismCountPicker = pickMeToo([
  [1, 1],
  [2, 100],
  [3, 20],
  [4, 2],
])

function pickConsonants(p: Phonology, rng: () => number, h: Hmm): [phonemeGenerator, phonemeGenerator, number, number] {
  const c = p.consonants ?? {}
  p.consonants = c
  if (c.placesOfArticulation === undefined || c.placesOfArticulation.length === 0) {
    c.placesOfArticulation = pickN(placeOfArticulationCountPicker(rng)(), placeOfArticulationPicker(rng))
  }
  if (c.voicingMechanisms === undefined || c.voicingMechanisms.length === 0) {
    let voicingMechanisms: Voicing[] = ['unvoiced']
    const numberVoicingMechanisms = voicingMechanismCountPicker(rng)()
    switch (numberVoicingMechanisms) {
      case 2:
      case 3:
        voicingMechanisms = pickN(numberVoicingMechanisms, voicingMechanismPicker(rng))
        break
      case 4:
        voicingMechanisms = ['voiced', 'unvoiced', 'aspirated', 'ejective']
    }
    c.voicingMechanisms = voicingMechanisms
  }
  c.mayHaveFricatives ??= h.maybe(0.8)
  c.mayHaveAffricates ??= h.maybe(0.2)
  c.mayHaveNasals ??= h.maybe(0.8)
  c.mayHaveApproximants ??= h.maybe(0.8)
  const stopsUndefined = !c.stops
  c.stops ??= []
  const fricativesUndefined = !c.fricatives
  c.fricatives ??= []
  const affricatesUndefined = !c.affricates
  c.affricates ??= []
  const nasalsUndefined = !c.nasals
  c.nasals ??= []
  const approximantsUndefined = !c.approximants
  c.approximants ??= []
  for (const type of c.placesOfArticulation!) {
    const place = consonants[type]
    // you always get some stops, if they are available
    if (stopsUndefined && place.stops) {
      const stops = c.stops
      for (const vm of c.voicingMechanisms) {
        for (let i = 0, l = place.stops[vm]?.length ?? 0; i < l; i++) {
          if (i) {
            if (h.maybe(1 / 2 ** i)) {
              stops.push(place.stops[vm][i])
            }
          } else {
            stops.push(place.stops[vm][0])
          }
        }
      }
    }
    // you may get the rest
    if (c.mayHaveFricatives && fricativesUndefined && place.fricatives) {
      const fricatives = c.fricatives
      for (const vm of c.voicingMechanisms) {
        for (let i = 0, l = place.fricatives[vm]?.length ?? 0; i < l; i++) {
          if (i) {
            if (h.maybe(1 / 2 ** i)) {
              fricatives.push(place.fricatives[vm][i])
            }
          } else {
            fricatives.push(place.fricatives[vm][0])
          }
        }
      }
    }
    if (c.mayHaveAffricates && affricatesUndefined && place.affricates) {
      const affricates = c.affricates
      for (const vm of c.voicingMechanisms) {
        for (let i = 0, l = place.affricates[vm]?.length ?? 0; i < l; i++) {
          if (i) {
            if (h.maybe(1 / 2 ** i)) {
              affricates.push(place.affricates[vm][i])
            }
          } else {
            affricates.push(place.affricates[vm][0])
          }
        }
      }
    }
    if (c.mayHaveNasals && nasalsUndefined && place.nasals) {
      const nasals = c.nasals
      for (const vm of c.voicingMechanisms) {
        for (let i = 0, l = place.nasals[vm]?.length ?? 0; i < l; i++) {
          if (i) {
            if (h.maybe(1 / 2 ** i)) {
              nasals.push(place.nasals[vm][i])
            }
          } else {
            nasals.push(place.nasals[vm][0])
          }
        }
      }
    }
    if (c.mayHaveApproximants && approximantsUndefined && place.approximants) {
      const approximants = c.approximants
      for (const vm of c.voicingMechanisms) {
        for (let i = 0, l = place.approximants[vm]?.length ?? 0; i < l; i++) {
          if (i) {
            if (h.maybe(1 / 2 ** i)) {
              approximants.push(place.approximants[vm][i])
            }
          } else {
            approximants.push(place.approximants[vm][0])
          }
        }
      }
    }
  }
  p.closedSyllables ??= h.maybe(0.8)
  p.consonantClusters ??= {}
  p.consonantClusters.initial ??= h.maybe(0.6)
  p.consonantClusters.final ??= p.consonantClusters.initial ? h.maybe(0.8) : h.maybe(0.2)
  const clustersPossible = Boolean(c.fricatives.length || c.nasals.length || c.approximants.length)
  p.consonantClusters.initial &&= clustersPossible
  p.consonantClusters.final &&= clustersPossible && p.closedSyllables
  const possibleClusters: string[] = []
  const simpleConsonants = c.stops.concat(c.nasals).concat(c.affricates).concat(c.fricatives).concat(c.approximants)
  let initialClusterFrequencies: [string, number][] = []
  let finalClusterFrequencies: [string, number][] = []
  if (p.consonantClusters.initial) {
    if (c.fricatives.length) {
      initialClusterFrequencies = initialClusterFrequencies.concat(clusterFrequencies(h, c.fricatives, c.stops))
      if (c.approximants.length)
        initialClusterFrequencies = initialClusterFrequencies.concat(
          clusterFrequencies(h, c.fricatives, c.stops, c.approximants),
        )
      if (c.nasals.length)
        initialClusterFrequencies = initialClusterFrequencies.concat(clusterFrequencies(h, c.fricatives, c.nasals))
      if (c.affricates.length)
        initialClusterFrequencies = initialClusterFrequencies.concat(clusterFrequencies(h, c.fricatives, c.affricates))
    }
    if (c.approximants.length) {
      initialClusterFrequencies = initialClusterFrequencies.concat(clusterFrequencies(h, c.stops, c.approximants))
      if (c.affricates.length)
        initialClusterFrequencies = initialClusterFrequencies.concat(
          clusterFrequencies(h, c.affricates, c.approximants),
        )
    }
  }
  if (p.consonantClusters.final) {
    if (c.nasals.length) {
      finalClusterFrequencies = finalClusterFrequencies.concat(clusterFrequencies(h, c.nasals, c.stops))
      if (c.fricatives.length) {
        finalClusterFrequencies = finalClusterFrequencies.concat(clusterFrequencies(h, c.nasals, c.stops, c.fricatives))
      }
    }
    if (c.approximants.length) {
      finalClusterFrequencies = finalClusterFrequencies.concat(clusterFrequencies(h, c.approximants, c.stops))
    }
  }
  let onset: MarginalParts = {
    simpleConsonants: compact(simpleConsonants.map((c) => (h.maybe(0.95) ? c : null))),
    clusters: initialClusterFrequencies,
  }
  let coda: MarginalParts = {
    simpleConsonants: compact(simpleConsonants.map((c) => (h.maybe(0.95) ? c : null))),
    clusters: finalClusterFrequencies,
  }
  return [
    consonantPicker(onset, h.fromRange(0, 0.3), h),
    consonantPicker(coda, h.fromRange(0.2, 0.9), h),
    marginalCombinations(onset),
    marginalCombinations(coda),
  ]
}

function clusterFrequencies(h: Hmm, ...parts: string[][]): [string, number][] {
  return combinations(parts).map((ar) => [ar.join(''), h.n()])
}

function marginalCombinations(mp: MarginalParts) {
  return mp.simpleConsonants.length + mp.clusters.length + 1
}

type MarginalParts = {
  simpleConsonants: string[]
  clusters: [string, number][]
}

function consonantPicker(parts: MarginalParts, probabilityAbsent: number, h: Hmm): phonemeGenerator {
  if (parts.simpleConsonants.length === 0) return () => ''
  const simpleFrequencies: [string, number][] = []
  const clusterFrequencies: [string, number][] = uniqBy(parts.clusters, ([k]) => k)
  for (const c of uniqBy(parts.simpleConsonants, (v) => v)) {
    simpleFrequencies.push([c, h.n()])
  }
  let simpleFrequency = 0
  for (const [, n] of simpleFrequencies) simpleFrequency += n
  if (clusterFrequencies.length === 0) {
    if (probabilityAbsent === 0) return pickMe(simpleFrequencies, h.rng)
    // add empty string output for absent consonant
    const a = (simpleFrequency * probabilityAbsent) / (1 - probabilityAbsent)
    simpleFrequencies.push(['', a])
    return pickMe(simpleFrequencies, h.rng)
  }

  // make adjustments so consonant clusters are always less common
  let clusterFrequency = 0
  for (const [, n] of clusterFrequencies) clusterFrequency += n
  const fractionClusters = h.fromRange(0, 0.5) // at most they are half as frequent
  const adjustment = (simpleFrequency * fractionClusters) / (clusterFrequency * (1 - fractionClusters))
  for (const pair of clusterFrequencies) pair[1] *= adjustment
  const frequencies: [string, number][] = simpleFrequencies.concat(clusterFrequencies)
  if (probabilityAbsent === 0) return pickMe(frequencies, h.rng)
  // add empty string for absent consonant
  let frequency = 0
  for (const [, n] of frequencies) frequency += n
  const a = (frequency * probabilityAbsent) / (1 - probabilityAbsent)
  frequencies.push(['', a])
  return pickMe(frequencies, h.rng)
}
