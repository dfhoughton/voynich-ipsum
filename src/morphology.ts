import { pickMe, pickMeToo, Rng } from 'pick-me-too'
import { Phonology, PhonologyEngine } from './phonology'
import { assertNever, Hmm, shuffle, uniqBy } from './util'

export type Morphology = {
  analytic?: boolean
  verbalInflections?: boolean
  nominalInflections?: boolean
  derivationalAdfixes?: boolean
  stemComplexity?: StemComplexity
  adfixStyle?: AdfixStyle
}

// where do inflectional suffixes go?
type AdfixStyle = 'prefix' | 'suffix' | 'both'

const adfixStyle = pickMeToo<AdfixStyle>([
  ['prefix', 3],
  ['suffix', 10],
  ['both', 1],
])

type StemComplexity = 'simple' | 'moderate' | 'complex'

const stemComplexity = pickMeToo<StemComplexity>([
  ['simple', 2],
  ['moderate', 4],
  ['complex', 1],
])

/**
 * A thing for building words.
 * 
 * A vast amount of morphology is ignored by this. There is no reduplication, for example.
 */
export class MorphologyEngine {
  private morphology: Morphology
  private phonologyEngine: Readonly<PhonologyEngine>
  private rng: Rng
  private stem!: () => string
  private phonology: Phonology
  private closedClassStems: Set<string>
  private adfixMaker!: () => string
  /**
   * Makes a small adverbish word. This will be from a closed class.
   */
  particle!: () => string
  /**
   * Makes a word with noun morphology. There is a closed class of common nouns
   * and an open class of less common nouns.
   */
  noun!: (stem?: string) => string
  /**
   * Picks a form from the closed class of pronouns.
   */
  pronoun!: () => string
  /**
   * Generates an adverbish thing.
   */
  adverb!: () => string
  /**
   * Makes a word with verbal morphology. There is a closed class of common verbs
   * and an open class of less common verbs.
   */
  verb!: (stem?: string) => string
  /**
   * Generates a noun stem. This may include derivational morphology but will not include
   * inflectional morphology.
   */
  nounStem!: () => string
  /**
   * Generates a verb stem. This may include derivational morphology but will not include
   * inflectional morphology.
   */
  verbStem!: () => string
  /**
   * Creates an instance of morphology engine.
   * @param p - the thing that will give us syllables
   * @param [m] - optional configuration parameters
   * @param [rng] - a random number generator with which to pick configuration parameters and then to build random words
   */
  constructor(p: Readonly<PhonologyEngine>, m: Morphology = {}, rng: Rng = () => Math.random()) {
    this.morphology = m
    this.phonologyEngine = p
    this.phonology = p.config()
    this.rng = rng
    this.closedClassStems = new Set()
    const h = new Hmm(rng)
    m.analytic ??= h.maybe(0.4)
    if (m.analytic) {
      m.verbalInflections = false
      m.nominalInflections = false
    } else {
      m.verbalInflections ??= h.maybe(0.9)
      m.nominalInflections ??= !m.verbalInflections || h.maybe(0.3)
    }
    m.derivationalAdfixes = !m.analytic || h.maybe(0.5)
    this.initializeAdfixMaker()
    this.initializeStemmer()
    this.initializeVerbs(h)
    this.initializeNominals(h)
    this.initializeAdverbs(h)
    this.particle = this.makeParticles(h.fromRange(10, 100), false)
  }

  // "adverbs" in this case just means not inflected
  private initializeAdverbs(h: Hmm) {
    const frequentAdverbLimit = h.fromRange(10, 50)
    const frequentAdverbProbability = h.fromRange(0.1, 0.5)
    const frequentAdverbs = []
    while (frequentAdverbs.length < frequentAdverbLimit) {
      const s = this.stem()
      if (this.addClosedClassItem(s)) frequentAdverbs.push(s)
    }
    const frequentFrequencies: [string, number][] = frequentAdverbs.map((s) => [s, h.n()])
    const frequentAdverbPicker = pickMe(frequentFrequencies, this.rng)
    this.adverb = () => (h.maybe(frequentAdverbProbability) ? frequentAdverbPicker() : this.stem())
  }

  // returns whether the item does not yet belong to the closed class
  // words in the language, adding it to the closed class if not
  private addClosedClassItem(s: string): boolean {
    if (!this.closedClassStems.has(s)) {
      this.closedClassStems.add(s)
      return true
    }
    return false
  }
  // create inflected noun and pronoun generators
  private initializeNominals(h: Hmm) {
    const lim = pickMe(
      [
        [3, 1],
        [4, 10],
        [5, 50],
        [6, 100],
        [7, 90],
        [8, 80],
        [9, 30],
        [10, 10],
        [11, 1],
      ],
      this.rng,
    )()
    const cc: string[] = []
    while (cc.length < lim) {
      const s = this.stem()
      if (this.addClosedClassItem(s)) {
        cc.push(s)
      }
    }
    const ccFrequencies = cc.map((s) => [s, h.n()] as [string, number])
    const inflector = this.makeInflector(h, false)
    const pronounPicker = pickMe(ccFrequencies, this.rng)
    this.pronoun = () => inflector(pronounPicker())
    const stem = this.makeInflectionalStem(h)
    this.nounStem = stem
    this.noun = (s?: string) => inflector(s ?? stem())
  }

  private makeInflector(h: Hmm, isVerb: boolean): (stem: string) => string {
    if (this.morphology.analytic) return (stem: string) => stem
    if (isVerb) {
      // potentially more complicated inflections
      let slotCount = pickMe(
        [
          [1, 5],
          [2, 3],
          [3, 2],
          [4, 1],
        ],
        this.rng,
      )()
      if (slotCount === 1 && this.morphology.adfixStyle === 'both') slotCount = 2
      const slots: (() => string)[] = []
      for (let i = 0; i < slotCount; i++) {
        slots.push(this.makeParticles(h.fromRange(2, 20), true))
      }
      let stemPosition = 0
      switch (this.morphology.adfixStyle!) {
        case 'prefix':
          stemPosition = slots.length
          break
        case 'suffix':
          stemPosition = 0
          break
        case 'both':
          stemPosition = Math.round(h.fromRange(1, slotCount - 1))
          break
        default:
          assertNever(this.morphology.adfixStyle! as never)
      }
      const lim = slots.length + 1
      return (stem: string) => {
        let s = ''
        for (let i = 0, j = 0; i < lim; i++) {
          s += i === stemPosition ? stem : slots[j++]()
        }
        return s
      }
    } else {
      // simpler inflections -- just one or two slots
      const slotCount = pickMe(
        [
          [1, 5],
          [2, 3],
        ],
        this.rng,
      )()
      let slots: (() => string)[] = []
      for (let i = 0; i < slotCount; i++) {
        const formCount =
          slots.length == 0
            ? pickMe(
                [
                  [4, 12],
                  [5, 11],
                  [6, 10],
                  [7, 9],
                  [8, 8],
                  [9, 7],
                  [10, 6],
                  [11, 4],
                  [12, 2],
                  [13, 1],
                  [14, 1],
                ],
                this.rng,
              )()
            : pickMe(
                // fewer this time
                [
                  [1, 5],
                  [2, 4],
                  [3, 2],
                  [4, 1],
                ],
                this.rng,
              )()
        slots.push(this.makeParticles(formCount, true))
      }
      // maybe make the shorter slot first
      if (slots.length === 2 && h.maybe(0.5)) {
        const [s1, s2] = slots
        slots = [s2, s1]
      }
      switch (this.morphology.adfixStyle!) {
        case 'prefix': {
          if (slots.length === 2) {
            const [s1, s2] = slots
            return (stem: string) => s1() + s2() + stem
          }
          const [s] = slots
          return (stem: string) => s() + stem
        }
        case 'suffix': {
          if (slots.length === 2) {
            const [s1, s2] = slots
            return (stem: string) => stem + s1() + s2()
          }
          const [s] = slots
          return (stem: string) => stem + s()
        }
        case 'both': {
          if (slots.length === 2) {
            const [s1, s2] = slots
            return (stem: string) => s1() + stem + s2()
          }
          const [s] = slots
          return (stem: string) => stem + s()
        }
        default:
          assertNever(this.morphology.adfixStyle! as never)
      }
    }
  }

  private makeInflectionalStem(h: Hmm) {
    const lim = h.fromRange(10, 100)
    const cc: string[] = []
    while (cc.length < lim) {
      const s = this.stem()
      if (this.addClosedClassItem(s)) {
        cc.push(s)
      }
    }
    const ccFrequencies = cc.map((s) => [s, h.n()] as [string, number])
    const ccStemPicker = pickMe(ccFrequencies, this.rng)
    let derivedStem = this.nonClosedClassStem.bind(this)
    if (this.morphology.derivationalAdfixes) {
      const adfixMakers: (() => string)[] = []
      for (let i = 0; i < 6; i++) adfixMakers.push(this.makeDerivationalAdfixes(h))
      const adfixCount = pickMe(
        [
          [0, 50],
          [1, 5],
          [2, 2],
          [3, 1],
        ],
        this.rng,
      )
      derivedStem = () => {
        const prefixCount = adfixCount(),
          suffixCount = adfixCount()
        if (prefixCount === 0 && suffixCount === 0) return this.nonClosedClassStem()
        let prefix = ''
        if (prefixCount > 0) {
          const ar = shuffle([0, 1, 2], this.rng).slice(0, prefixCount)
          ar.sort()
          for (const i of ar) {
            prefix += adfixMakers[i]()
          }
        }
        let suffix = ''
        if (suffixCount > 0) {
          const ar = shuffle([3, 4, 5], this.rng).slice(0, suffixCount)
          ar.sort()
          for (const i of ar) {
            suffix += adfixMakers[i]()
          }
        }
        return prefix + this.nonClosedClassStem() + suffix
      }
    }
    const threshold = h.fromRange(0.2, 0.35)
    return () => (h.maybe(threshold) ? ccStemPicker() : derivedStem())
  }

  private initializeAdfixMaker() {
    this.morphology.adfixStyle ??= adfixStyle(this.rng)()
    const syllableComplexity = this.phonology.numberPossibleSyllables ?? 0
    // the simpler the syllables the more syllables in the adfixes
    const frequencies: [number, number][] =
      syllableComplexity < 100
        ? [
            [1, 4],
            [2, 3],
            [3, 2],
            [4, 1],
          ]
        : syllableComplexity < 1000
        ? [
            [1, 5],
            [2, 2],
            [3, 1],
          ]
        : [
            [1, 5],
            [2, 1],
          ]
    const lengthPicker = pickMe(frequencies, this.rng)
    this.adfixMaker = () => {
      let s = ''
      // maximum of 1000 tries to find a novel adfix
      for (let attempt = 0; attempt < 1000; attempt++) {
        s = ''
        for (let i = 0, lim = lengthPicker(); i < lim; i++) s += this.phonologyEngine.syllable()
        if (this.addClosedClassItem(s)) return s
      }
      return s
    }
  }

  private nonClosedClassStem(): string {
    let stem = this.stem()
    while (this.closedClassStems.has(stem)) stem = this.stem()
    return stem
  }

  // generate a function that makes an uninflected stem
  private initializeStemmer() {
    this.morphology.stemComplexity ??= stemComplexity(this.rng)()
    let lengthPicker: () => number
    switch (this.morphology.stemComplexity) {
      case 'simple':
        lengthPicker = pickMe(
          [
            [1, 10],
            [2, 1],
          ],
          this.rng,
        )
        break
      case 'moderate':
        lengthPicker = pickMe(
          [
            [1, 10],
            [2, 5],
            [3, 1],
          ],
          this.rng,
        )
        break
      case 'complex':
        lengthPicker = pickMe(
          [
            [1, 10],
            [2, 10],
            [3, 5],
            [4, 2],
            [5, 1],
          ],
          this.rng,
        )
        break
      default:
        assertNever(this.morphology.stemComplexity)
    }
    this.stem = () => {
      let s = ''
      for (let i = 0, lim = lengthPicker(); i < lim; i++) {
        s += this.phonologyEngine.syllable()
      }
      return s
    }
  }
  private initializeVerbs(h: Hmm) {
    const stem = this.makeInflectionalStem(h)
    this.verbStem = stem
    const inflector = this.makeInflector(h, true)
    this.verb = (s?: string) => inflector(s ?? stem())
  }
  // useful for making inflections and particles
  private simpleSyllable(): string {
    if (this.phonology.closedSyllables || this.phonology.consonantClusters?.initial) {
      const ar: string[] = []
      // yeah, not so efficient, but we just use this during language initialization
      for (let i = 0; i < 4; i++) {
        ar.push(this.phonologyEngine.syllable())
      }
      ar.sort((a, b) => a.length - b.length)
      return ar[0]
    } else {
      return this.phonologyEngine.syllable()
    }
  }

  // returns a copy of the phonology (copy to prevent mistaken monkeybusiness)
  /**
   * Provides the configuration parameters used by the engine.
   * 
   * This configuration should be read-only. In any case, changing it will have no effect on
   * the behavior of the engine, since configuration parameters are only consulted during initialization.
   * 
   * If you find a language whose word shapes you like, you can use this to obtain its configuration and
   * then copy it to other languages.
   * 
   * @returns configuration parameters 
   */
  config(): Readonly<Morphology> {
    return this.morphology
  }

  private makeDerivationalAdfixes(h: Hmm): () => string {
    const adfixMaker = this.initializeAdfixMaker()
    const adfixFrequencies: [string, number][] = []
    for (let i = 0, lim = h.fromRange(10, 15); i < lim; i++) {
      adfixFrequencies.push([this.adfixMaker(), h.n()])
    }
    return pickMe(
      uniqBy(adfixFrequencies, ([v]) => v),
      this.rng,
    )
  }

  /**
   * Creates a closed class of morphemes that will appear in a particular morphological or syntactic "slot".
   * This is a public method mostly because syntax engines need it.
   * 
   * @param n -- a number of "particles" to make
   * @param includeBlank -- whether the null particle should be among the particles
   * @returns a collection of morphemes
   */
  makeParticles(n: number, includeBlank: boolean): () => string {
    const seen: Set<string> = new Set()
    let found: string[] = []
    // NOTE: there is a possibility for an infinite loop here if we ask for too many variants!
    let safety = 0 // we'll just cut things off after 1000 samples if we get that far
    // we assume inflectional morphemes tend to have relatively simple syllable structure,
    // so for languages with complex syllable structure, we overgenerate candidates and filter
    // NOTE: to simplify things we aren't generating any multi-syllabic morphemes like Latin -ōrum

    while (found.length < n && safety < 1000) {
      const s = this.simpleSyllable()
      if (!seen.has(s)) {
        seen.add(s)
        found.push(s)
      }
      safety++
    }
    const frequencies = found.map((s) => [s, this.rng()] as [string, number])
    if (includeBlank) frequencies.push(['', this.rng() * 2]) // blanks are more common
    return pickMe(frequencies, this.rng)
  }
}
