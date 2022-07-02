import { pickMe, Rng } from 'pick-me-too'
import { MorphologyEngine } from './morphology'
import { Hmm, shuffle } from './util'

export type Syntax = {
  basicWordOrder?: BasicWordOrder
  questionParticlePosition?: DiscourseParticlePosition
  assertionParticlePosition?: DiscourseParticlePosition
  modifierPosition?: RelativeOrder
  adpositionPosition?: RelativeOrder
  usesAuxiliaryVerbs?: boolean
}

// probabilities taken from https://en.wikipedia.org/wiki/Word_order#Distribution_of_word_order_types
// using Dryer's frequencies
type BasicWordOrder = 'SOV' | 'SVO' | 'VSO' | 'VOS' | 'OVS' | 'OSV' | 'Unfixed'

type DiscourseParticlePosition = 'initial' | 'final' | 'none'

type RelativeOrder = 'before' | 'after'

type NounPhraseParams = {
  stem?: string
  simple?: boolean
}

/**
 * The thing that puts words in order.
 */
export class SyntaxEngine {
  private morphology: MorphologyEngine
  private syntax: Syntax
  private rng: Rng
  private stemlessNoun!: () => string
  private nounModifier!: () => null | string
  private relativeParticle!: string
  private basicClause!: (...topics: string[]) => string
  assertionParticle?: () => string
  questionParticle?: () => string
  adposition!: () => string
  nounPhrase!: (params?: NounPhraseParams) => string
  verbPhrase!: (stem?: string) => string
  adpositionPhrase!: (stem?: string) => string
  adverbial!: () => string
  assertion!: (...topics: string[]) => string
  question!: (...topics: string[]) => string
  exclamation!: (...topics: string[]) => string
  constructor(m: MorphologyEngine, s: Syntax = {}, rng: Rng = () => Math.random()) {
    this.syntax = s
    this.morphology = m
    this.rng = rng
    const hmm = new Hmm(rng)
    // we build up all our public methods as closures to offload the heavy lifting
    // to initialization
    this.initializeWordOrder()
    this.initializeAssertionParticlePosition()
    this.initializeQuestionParticlePosition()
    this.initializeAdpositionPosition()
    this.initializeModifierPosition()
    this.initializeNounModifier(hmm)
    this.initializeNounPhrase(hmm)
    this.initializeVerbPhrase(hmm)
    this.initializeAdverbials(hmm)
    this.initializeAdpositionPhrase()
    this.initializeAssertion()
    this.initializeQuestion()
  }
  private initializeNounModifier(hmm: Hmm) {
    const modifierProbability = hmm.fromRange(0.05, 0.2)
    // for now we're going to have simple relative clauses
    this.relativeParticle = this.morphology.makeParticles(1, false)()
    const modifierType = pickMe(
      [
        // pulled out of hat
        [() => this.nounPhrase(), 1],
        [() => this.morphology.noun(), 10], // roughly an adjective
        [() => this.adpositionPhrase(), 2], // yeah, the word order is going to be screwy
        [() => `${this.relativeParticle} ${this.basicClause()}`, 1], // relative clause
      ],
      this.rng,
    )
    this.nounModifier = () => {
      if (hmm.maybe(modifierProbability)) {
        const modifier = modifierType()()
        const additionalModifier = this.nounModifier()
        return additionalModifier ? `${modifier} ${additionalModifier}` : modifier
      } else {
        return null
      }
    }
  }
  private initializeQuestion() {
    switch (this.syntax.questionParticlePosition!) {
      case 'initial':
        this.question = (...topics: string[]) => {
          const p = this.questionParticle!()
          const clause = this.basicClause()
          return titleize(p ? `${p} ${clause}?` : `${clause}?`)
        }
      case 'final':
        this.question = (...topics: string[]) => {
          const p = this.questionParticle!()
          const clause = this.basicClause()
          return titleize(p ? `${clause} ${p}?` : `${clause}?`)
        }
      default:
        this.question = (...topics: string[]) => titleize(`${this.basicClause()}?`)
    }
  }
  private initializeAdverbials(hmm: Hmm) {
    this.adverbial = () => (hmm.maybe(0.1) ? this.adpositionPhrase() : this.morphology.adverb())
  }
  private initializeAssertion() {
    // assume most verbs are used intransitively, ditransitives are rare
    const argumentCount = pickMe(
      [
        [0, 12],
        [1, 8],
        [2, 1],
      ],
      this.rng,
    )
    let basicClause: (...topics: string[]) => string
    switch (this.syntax.basicWordOrder!) {
      case 'VSO':
        {
          basicClause = (...topics: string[]): string => {
            const ar = [this.verbPhrase()]
            let n = argumentCount()
            while (n--) ar.push(this.nounPhrase({ stem: topics.shift() }))
            return ar.join(' ')
          }
        }
        break
      case 'SVO':
        {
          basicClause = (...topics: string[]): string => {
            const ar = []
            let n = argumentCount()
            while (n--) ar.push(this.nounPhrase({ stem: topics.shift() }))
            if (ar.length) {
              ar.splice(1, 0, this.verbPhrase())
            } else {
              ar.push(this.verbPhrase())
            }
            return ar.join(' ')
          }
        }
        break
      case 'SOV':
        {
          basicClause = (...topics: string[]): string => {
            const ar = []
            let n = argumentCount()
            while (n--) ar.push(this.nounPhrase({ stem: topics.shift() }))
            ar.push(this.verbPhrase())
            return ar.join(' ')
          }
        }
        break
      case 'VOS':
        {
          basicClause = (...topics: string[]): string => {
            const ar = []
            let n = argumentCount()
            while (n--) ar.push(this.nounPhrase({ stem: topics.shift() }))
            ar.reverse()
            ar.unshift(this.verbPhrase())
            return ar.join(' ')
          }
        }
        break
      case 'OVS':
        {
          basicClause = (...topics: string[]): string => {
            const ar = []
            let n = argumentCount()
            while (n--) ar.push(this.nounPhrase({ stem: topics.shift() }))
            ar.reverse()
            if (ar.length) {
              ar.splice(1, 0, this.verbPhrase())
            } else {
              ar.push(this.verbPhrase())
            }
            return ar.join(' ')
          }
        }
        break
      case 'OSV':
        {
          basicClause = (...topics: string[]): string => {
            const ar = []
            let n = argumentCount()
            while (n--) ar.push(this.nounPhrase({ stem: topics.shift() }))
            ar.reverse()
            ar.push(this.verbPhrase())
            return ar.join(' ')
          }
        }
        break
      default:
        basicClause = (...topics: string[]): string => {
          const ar = [this.verbPhrase()]
          let n = argumentCount()
          while (n--) ar.push(this.nounPhrase({ stem: topics.shift() }))
          return shuffle(ar, this.rng).join(' ')
        }
    }
    this.basicClause = basicClause
    switch (this.syntax.assertionParticlePosition) {
      case 'initial':
        this.assertion = (...topics: string[]) => {
          const p = this.assertionParticle!()
          const clause = this.basicClause(...topics)
          return titleize(p ? `${p} ${clause}.` : `${clause}.`)
        }
        break
      case 'final':
        this.assertion = (...topics: string[]) => {
          const p = this.assertionParticle!()
          const clause = this.basicClause(...topics)
          return titleize(p ? `${clause} ${p}.` : `${clause}.`)
        }
        break
      default:
        this.assertion = (...topics: string[]) =>
          titleize(`${this.basicClause(...topics)}.`)
    }
    switch (this.syntax.assertionParticlePosition) {
        case 'initial':
          this.exclamation = (...topics: string[]) => {
            const p = this.assertionParticle!()
            const clause = this.basicClause(...topics)
            return titleize(p ? `${p} ${clause}!` : `${clause}!`)
          }
          break
        case 'final':
          this.exclamation = (...topics: string[]) => {
            const p = this.assertionParticle!()
            const clause = this.basicClause(...topics)
            return titleize(p ? `${clause} ${p}!` : `${clause}!`)
          }
          break
        default:
          this.exclamation = (...topics: string[]) =>
            titleize(`${this.basicClause(...topics)}!`)
      }
    }
  private initializeAdpositionPhrase() {
    if (this.syntax.adpositionPosition === 'before') {
      this.adpositionPhrase = (stem?: string) =>
        `${this.adposition()} ${stem ? this.nounPhrase({ stem }) : this.stemlessNoun()}`
    } else {
      this.adpositionPhrase = (stem?: string) =>
        `${stem ? this.nounPhrase({ stem }) : this.stemlessNoun()} ${this.adposition()}`
    }
  }
  private initializeVerbPhrase(hmm: Hmm) {
    this.syntax.usesAuxiliaryVerbs ??= this.morphology.config().analytic ? hmm.maybe(0.95) : hmm.maybe(0.1)
    let verb: (stem?: string) => string
    if (this.syntax.usesAuxiliaryVerbs) {
      const auxiliaryVerbs = this.morphology.makeParticles(
        pickMe(
          [
            // pulled out of hat
            [3, 10],
            [4, 40],
            [5, 60],
            [6, 80],
            [7, 95],
            [8, 100],
            [9, 90],
            [10, 50],
          ],
          this.rng,
        )(),
        false,
      )
      // if we can have auxiliary verbs, assume we usually have them
      const threshold = hmm.fromRange(0.1, 0.5)
      verb = (stem?: string) =>
        hmm.maybe(threshold)
          ? this.morphology.verb(stem)
          : // yep, this assumes a fixed order or these, and only one auxiliary verb
            `${this.morphology.verb(auxiliaryVerbs())} ${stem ?? this.morphology.verbStem()}`
    } else {
      verb = (stem?: string) => this.morphology.verb(stem)
    }
    const adverbialCount = pickMe(
      [
        [0, 50],
        [1, 2],
        [2, 1],
      ],
      this.rng,
    )
    if (this.syntax.modifierPosition === 'before') {
      this.verbPhrase = (stem?: string) => {
        const ar: string[] = []
        let n = adverbialCount()
        while (n--) ar.push(this.adverbial())
        ar.push(verb(stem))
        return ar.join(' ')
      }
    } else {
      this.verbPhrase = (stem?: string) => {
        const ar: string[] = [verb(stem)]
        let n = adverbialCount()
        while (n--) ar.push(this.adverbial())
        return ar.join(' ')
      }
    }
  }
  private initializeNounPhrase(hmm: Hmm) {
    this.stemlessNoun = () => (hmm.maybe(0.2) ? this.morphology.pronoun() : this.nounPhrase())
    if (this.syntax.modifierPosition === 'before') {
      this.nounPhrase = (params?: NounPhraseParams) => {
        const noun = this.morphology.noun(params?.stem)
        const modifier = this.nounModifier()
        return modifier ? `${modifier} ${noun}` : noun
      }
    } else {
      this.nounPhrase = (params?: NounPhraseParams) => {
        const noun = this.morphology.noun(params?.stem)
        const modifier = this.nounModifier()
        return modifier ? `${noun} ${modifier}` : noun
      }
    }
  }
  private initializeAdpositionPosition() {
    this.adposition = this.morphology.makeParticles(
      pickMe(
        [
          // mostly arbitrary
          [6, 1],
          [7, 2],
          [8, 4],
          [9, 8],
          [10, 16],
        ],
        this.rng,
      )(),
      false,
    )
    if (this.syntax.adpositionPosition !== undefined) return
    // loosely taken from https://en.wikipedia.org/wiki/Linguistic_typology#Syntactic_typology
    let frequencies: [RelativeOrder, number][]
    switch (this.syntax.basicWordOrder!) {
      case 'SOV':
      case 'OVS':
      case 'OSV':
        frequencies = [
          ['before', 1],
          ['after', 6],
        ]
        break
      case 'SVO':
      case 'VOS':
      case 'VSO':
        frequencies = [
          ['before', 6],
          ['after', 1],
        ]
        break
      default:
        frequencies = [
          ['before', 4],
          ['after', 1],
        ]
    }
    this.syntax.adpositionPosition = pickMe(frequencies, this.rng)()
  }
  private initializeModifierPosition() {
    // from https://wals.info/chapter/87
    this.syntax.modifierPosition ??= pickMe<RelativeOrder>(
      [
        ['before', 1],
        ['after', 2],
      ],
      this.rng,
    )()
  }
  private initializeQuestionParticlePosition() {
    if (this.syntax.questionParticlePosition !== undefined) return
    switch (this.syntax.assertionParticlePosition!) {
      case 'initial':
        {
          this.syntax.questionParticlePosition = pickMe<DiscourseParticlePosition>(
            [
              ['initial', 10],
              ['final', 2],
              ['none', 1],
            ],
            this.rng,
          )()
        }
        break
      case 'final':
        {
          this.syntax.questionParticlePosition = pickMe<DiscourseParticlePosition>(
            [
              ['initial', 2],
              ['final', 10],
              ['none', 1],
            ],
            this.rng,
          )()
        }
        break
      default: {
        this.syntax.questionParticlePosition = pickMe<DiscourseParticlePosition>(
          [
            ['initial', 3],
            ['final', 2],
            ['none', 5],
          ],
          this.rng,
        )()
      }
    }
    if (this.syntax.questionParticlePosition !== 'none') {
      // very arbitrary
      const n = pickMe(
        [
          [1, 4],
          [2, 2],
          [3, 1],
        ],
        this.rng,
      )()
      this.questionParticle = this.morphology.makeParticles(n, true)
    }
  }
  private initializeAssertionParticlePosition() {
    this.syntax.assertionParticlePosition ??= pickMe<DiscourseParticlePosition>(
      [
        ['initial', 1],
        ['final', 10],
        ['none', 20],
      ],
      this.rng,
    )()
    if (this.syntax.assertionParticlePosition !== 'none') {
      // very arbitrary
      const n = pickMe(
        [
          [1, 16],
          [2, 8],
          [3, 4],
          [4, 2],
          [5, 1],
        ],
        this.rng,
      )()
      this.assertionParticle = this.morphology.makeParticles(n, true)
    }
  }
  private initializeWordOrder() {
    this.syntax.basicWordOrder ??= pickMe<BasicWordOrder>(
      [
        ['SOV', 565],
        ['SVO', 488],
        ['VSO', 95],
        ['VOS', 25],
        ['OVS', 11],
        ['OSV', 4],
        ['Unfixed', 189],
      ],
      this.rng,
    )()
  }
  config(): Readonly<Syntax> {
    return this.syntax
  }
}

function titleize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
  