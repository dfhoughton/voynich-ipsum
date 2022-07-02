import { pickMe, rando } from 'pick-me-too'
import { Phonology, PhonologyEngine } from './phonology'
import { dupParams } from './util'

export type LanguageParameters = {
  seed?: number
  params?: { phonology?: Phonology; orthography?: Orthography; morphology?: Morphology; syntax?: Syntax }
}

export type Orthography = {
  digraphs?: boolean
  diacritics?: boolean
}

export type Morphology = {}

export type Syntax = {}

export class Language {
  private rng: () => number
  // a frozen version of the parameters the language was initialized with
  private initialParameters: LanguageParameters
  private _params: LanguageParameters
  private phonologyEngine: PhonologyEngine
  // the fully-specified parameters of the language
  public get params(): LanguageParameters {
    return dupParams(this._params)
  }

  constructor({ seed, params = {} }: LanguageParameters = {}) {
    seed ??= Math.random() * 1000 // 1000 to make it more human-friendly
    const rng = rando(seed)
    this.rng = rng
    this.initialParameters = dupParams({ seed, params })
    const { phonology = {}, orthography = {}, morphology = {}, syntax = {} } = params
    this.phonologyEngine = new PhonologyEngine(phonology, rng)
    this._params = { seed, params: { phonology, orthography, morphology, syntax } }
    this.init()
  }
  // define all the properties of the language
  private init() {
    this.initializeOrthography()
    this.initializeMorphology()
    this.initializeSyntax()
  }
  private initializeOrthography() {
    const { orthography = {} } = this._params.params!
    orthography.digraphs ??= this.maybe()
    orthography.diacritics ??= this.maybe()
  }
  // generate a random boolean
  private maybe(threshold: number = 0.5): boolean {
    return this.rng() > threshold
  }
  private initializeSyntax() {
    const { syntax = {} } = this._params.params!
    throw new Error('Method not implemented.')
  }
  private initializeMorphology() {
    const { morphology = {} } = this._params.params!
    // analytic
    // synthetic
    // prefixing
    // suffixing
    // derivational morphology
    // inflectional morphology
    // verb picker
    // inflected non-verb
    // particles
    throw new Error('Method not implemented.')
  }
  // advance the language's random number sequence a random
  // number of steps, the number being roughly of the given magnitude
  public scramble(magnitude: number = 100000) {
    for (let i = 0, lim = Math.random() * magnitude; i < lim; i++) this.rng()
  }

  public serialize(): LanguageParameters {
    return dupParams(this.initialParameters)
  }
}

const DECIDER = {}
