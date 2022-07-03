import { pickMe, pickMeToo, Rng } from 'pick-me-too'
import { MorphologyEngine } from './morphology'
import { capitalize, Hmm, shuffle } from './util'

export type Syntax = {
  verbRequiresSubject?: boolean
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

type SententialParticlePosition = 'initial' | 'final' | 'beforeVerb' | 'afterVerb'

/**
 * The thing that puts words in order.
 */
export class SyntaxEngine {
  private morphology: Readonly<MorphologyEngine>
  private syntax: Syntax
  private rng: Rng
  private stemlessNoun!: () => string
  private nounModifier!: () => null | string
  private relativeParticle!: string
  private basicClause!: (...topics: string[]) => string
  private sententialParticlePositions!: () => Record<SententialParticlePosition, number>
  assertionParticle?: () => string
  questionParticle?: () => string
  adposition!: () => string
  nounPhrase!: (stem?: string) => string
  verbPhrase!: (stem?: string) => string
  adpositionPhrase!: (stem?: string) => string
  adverbial!: () => string
  assertion!: (...topics: string[]) => string
  question!: (...topics: string[]) => string
  exclamation!: (...topics: string[]) => string
  constructor(m: Readonly<MorphologyEngine>, s: Syntax = {}, rng: Rng = () => Math.random()) {
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
    this.initializeSententialParticlePositions(hmm)
    this.initializeAssertion(hmm)
    this.initializeQuestion()
  }
  private initializeSententialParticlePositions(hmm: Hmm) {
    // mostly ad hoc -- these are sentence level adverbials, like 'lo and behold' or 'indeed'
    const anyParticles = hmm.fromRange(0.01, 0.5)
    const numberPicker = sententialParticleCountPicker(this.rng)
    const positionPicker = pickMe(
      (['initial', 'final', 'beforeVerb', 'afterVerb'] as SententialParticlePosition[]).map((s) => [s, this.rng()]) as [
        SententialParticlePosition,
        number,
      ][],
      this.rng,
    )
    const sententialParticlePositions = () => {
      const rv: Record<SententialParticlePosition, number> = {
        initial: 0,
        final: 0,
        beforeVerb: 0,
        afterVerb: 0,
      }
      if (hmm.maybe(anyParticles)) {
        const count = numberPicker()
        for (let i = 0; i < count; i++) rv[positionPicker()]++
      }
      return rv
    }
    this.sententialParticlePositions = sententialParticlePositions
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
          const clause = this.basicClause(...topics)
          return capitalize(p ? `${p} ${clause}?` : `${clause}?`)
        }
      case 'final':
        this.question = (...topics: string[]) => {
          const p = this.questionParticle!()
          const clause = this.basicClause(...topics)
          return capitalize(p ? `${clause} ${p}?` : `${clause}?`)
        }
      default:
        this.question = (...topics: string[]) => capitalize(`${this.basicClause(...topics)}?`)
    }
  }
  private initializeAdverbials(hmm: Hmm) {
    this.adverbial = () => (hmm.maybe(0.1) ? this.adpositionPhrase() : this.morphology.adverb())
  }
  private initializeAssertion(hmm: Hmm) {
    const argumentCount = (
      this.syntax.verbRequiresSubject ? argumentCountPickerSubjectIsRequired : argumentCountPickerSubjectNotRequired
    )(this.rng)
    let basicClause: (...topics: string[]) => string
    switch (this.syntax.basicWordOrder!) {
      case 'VSO':
        {
          basicClause = (...topics: string[]): string => {
            const pp = this.sententialParticlePositions()
            const ar: string[] = []
            while (pp.initial--) ar.push(this.morphology.particle())
            while (pp.beforeVerb--) ar.push(this.morphology.particle())
            ar.push(this.verbPhrase())
            while (pp.afterVerb--) ar.push(this.morphology.particle())
            let n = argumentCount()
            while (n--) ar.push(this.nounPhrase(topics.shift()))
            while (pp.final--) ar.push(this.morphology.particle())
            return ar.join(' ')
          }
        }
        break
      case 'SVO':
        {
          basicClause = (...topics: string[]): string => {
            const pp = this.sententialParticlePositions()
            const ar: string[] = []
            const verbPhrase: string[] = []
            while (pp.beforeVerb--) verbPhrase.push(this.morphology.particle())
            verbPhrase.push(this.verbPhrase())
            while (pp.afterVerb--) verbPhrase.push(this.morphology.particle())
            while (pp.initial--) ar.push(this.morphology.particle())
            let n = argumentCount()
            while (n--) ar.push(this.nounPhrase(topics.shift()))
            if (ar.length) {
              ar.splice(1, 0, ...verbPhrase)
            } else {
              ar.splice(0, 0, ...verbPhrase)
            }
            while (pp.final--) ar.push(this.morphology.particle())
            return ar.join(' ')
          }
        }
        break
      case 'SOV':
        {
          basicClause = (...topics: string[]): string => {
            const pp = this.sententialParticlePositions()
            const ar: string[] = []
            while (pp.initial--) ar.push(this.morphology.particle())
            let n = argumentCount()
            while (n--) ar.push(this.nounPhrase(topics.shift()))
            while (pp.beforeVerb--) ar.push(this.morphology.particle())
            ar.push(this.verbPhrase())
            while (pp.afterVerb--) ar.push(this.morphology.particle())
            while (pp.final--) ar.push(this.morphology.particle())
            return ar.join(' ')
          }
        }
        break
      case 'VOS':
        {
          basicClause = (...topics: string[]): string => {
            const pp = this.sententialParticlePositions()
            const ar: string[] = []
            while (pp.initial--) ar.push(this.morphology.particle())
            while (pp.beforeVerb--) ar.push(this.morphology.particle())
            ar.push(this.verbPhrase())
            while (pp.afterVerb--) ar.push(this.morphology.particle())
            const args: string[] = []
            let n = argumentCount()
            while (n--) args.push(this.nounPhrase(topics.shift()))
            ar.push(...args.reverse())
            while (pp.final--) ar.push(this.morphology.particle())
            return ar.join(' ')
          }
        }
        break
      case 'OVS':
        {
          basicClause = (...topics: string[]): string => {
            const pp = this.sententialParticlePositions()
            const ar: string[] = []
            while (pp.initial--) ar.push(this.morphology.particle())
            let args: string[] = []
            let n = argumentCount()
            while (n--) args.push(this.nounPhrase(topics.shift()))
            args = args.reverse()
            const verbPhrase: string[] = []
            while (pp.beforeVerb--) verbPhrase.push(this.morphology.particle())
            verbPhrase.push(this.verbPhrase())
            while (pp.afterVerb--) verbPhrase.push(this.morphology.particle())
            ar.reverse()
            if (args.length) {
              args.splice(1, 0, ...verbPhrase)
            } else {
              args.push(...verbPhrase)
            }
            ar.push(...args)
            while (pp.final--) ar.push(this.morphology.particle())
            return ar.join(' ')
          }
        }
        break
      case 'OSV':
        {
          basicClause = (...topics: string[]): string => {
            const pp = this.sententialParticlePositions()
            const ar: string[] = []
            while (pp.initial--) ar.push(this.morphology.particle())
            let args: string[] = []
            let n = argumentCount()
            while (n--) args.push(this.nounPhrase(topics.shift()))
            ar.push(...args)
            while (pp.beforeVerb--) ar.push(this.morphology.particle())
            ar.push(this.verbPhrase())
            while (pp.afterVerb--) ar.push(this.morphology.particle())
            while (pp.final--) ar.push(this.morphology.particle())
            return ar.join(' ')
          }
        }
        break
      default:
        basicClause = (...topics: string[]): string => {
          const pp = this.sententialParticlePositions()
          const ar: string[] = []
          while (pp.initial--) ar.push(this.morphology.particle())
          const verbPhrase: string[] = []
          while (pp.beforeVerb--) verbPhrase.push(this.morphology.particle())
          verbPhrase.push(this.verbPhrase())
          while (pp.afterVerb--) verbPhrase.push(this.morphology.particle())
          let args: string[] = []
          let n = argumentCount()
          while (n--) args.push(this.nounPhrase(topics.shift()))
          args = shuffle(args, this.rng)
          args.splice(Math.round(hmm.fromRange(0, args.length)), 0, ...verbPhrase)
          ar.push(...args)
          while (pp.final--) ar.push(this.morphology.particle())
          return ar.join(' ')
        }
    }
    this.basicClause = basicClause
    switch (this.syntax.assertionParticlePosition) {
      case 'initial':
        this.assertion = (...topics: string[]) => {
          const p = this.assertionParticle!()
          const clause = this.basicClause(...topics)
          return capitalize(p ? `${p} ${clause}.` : `${clause}.`)
        }
        break
      case 'final':
        this.assertion = (...topics: string[]) => {
          const p = this.assertionParticle!()
          const clause = this.basicClause(...topics)
          return capitalize(p ? `${clause} ${p}.` : `${clause}.`)
        }
        break
      default:
        this.assertion = (...topics: string[]) => capitalize(`${this.basicClause(...topics)}.`)
    }
    switch (this.syntax.assertionParticlePosition) {
      case 'initial':
        this.exclamation = (...topics: string[]) => {
          const p = this.assertionParticle!()
          const clause = this.basicClause(...topics)
          return capitalize(p ? `${p} ${clause}!` : `${clause}!`)
        }
        break
      case 'final':
        this.exclamation = (...topics: string[]) => {
          const p = this.assertionParticle!()
          const clause = this.basicClause(...topics)
          return capitalize(p ? `${clause} ${p}!` : `${clause}!`)
        }
        break
      default:
        this.exclamation = (...topics: string[]) => capitalize(`${this.basicClause(...topics)}!`)
    }
  }
  private initializeAdpositionPhrase() {
    if (this.syntax.adpositionPosition === 'before') {
      this.adpositionPhrase = (stem?: string) =>
        `${this.adposition()} ${stem ? this.nounPhrase(stem) : this.stemlessNoun()}`
    } else {
      this.adpositionPhrase = (stem?: string) =>
        `${stem ? this.nounPhrase(stem) : this.stemlessNoun()} ${this.adposition()}`
    }
  }
  private initializeVerbPhrase(hmm: Hmm) {
    this.syntax.verbRequiresSubject ??= hmm.maybe(0.5)
    this.syntax.usesAuxiliaryVerbs ??= this.morphology.config().analytic ? hmm.maybe(0.95) : hmm.maybe(0.1)
    let verb: (stem?: string) => string
    if (this.syntax.usesAuxiliaryVerbs) {
      const auxiliaryVerbs = this.morphology.makeParticles(auxiliaryVerbCount(this.rng)(), false)
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
    const adverbialCount = adverbialCountMaker(this.rng)
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
      this.nounPhrase = (stem?: string) => {
        const noun = this.morphology.noun(stem)
        const modifier = this.nounModifier()
        return modifier ? `${modifier} ${noun}` : noun
      }
    } else {
      this.nounPhrase = (stem?: string) => {
        const noun = this.morphology.noun(stem)
        const modifier = this.nounModifier()
        return modifier ? `${noun} ${modifier}` : noun
      }
    }
  }
  private initializeAdpositionPosition() {
    this.adposition = this.morphology.makeParticles(auxiliaryCountMaker(this.rng)(), false)
    if (this.syntax.adpositionPosition !== undefined) return
    let adpositionPosition: (rng: Rng) => () => RelativeOrder
    switch (this.syntax.basicWordOrder!) {
      case 'SOV':
      case 'OVS':
      case 'OSV':
        adpositionPosition = OVAdpositionOrderPicker
        break
      case 'SVO':
      case 'VOS':
      case 'VSO':
        adpositionPosition = VOAdpositionOrderPicker
        break
      default:
        adpositionPosition = nonconfigurationalAdpositionOrderPicker
    }
    this.syntax.adpositionPosition = adpositionPosition(this.rng)()
  }
  private initializeModifierPosition() {
    this.syntax.modifierPosition ??= modifierPositionPicker(this.rng)()
  }
  private initializeQuestionParticlePosition() {
    if (this.syntax.questionParticlePosition !== undefined) return
    switch (this.syntax.assertionParticlePosition!) {
      case 'initial':
        this.syntax.questionParticlePosition = questionParticlePositionPickerInitial(this.rng)()
        break
      case 'final':
        this.syntax.questionParticlePosition = questionParticlePositionPickerFinal(this.rng)()
        break
      default:
        this.syntax.questionParticlePosition = questionParticlePositionPickerNone(this.rng)()
    }
    if (this.syntax.questionParticlePosition !== 'none') {
      const n = questionParticleCountPicker(this.rng)()
      this.questionParticle = this.morphology.makeParticles(n, true)
    }
  }
  private initializeAssertionParticlePosition() {
    this.syntax.assertionParticlePosition ??= assertionParticlePositionPicker(this.rng)()
    if (this.syntax.assertionParticlePosition !== 'none') {
      const n = assertionParticleCountPicker(this.rng)()
      this.assertionParticle = this.morphology.makeParticles(n, true)
    }
  }
  private initializeWordOrder() {
    this.syntax.basicWordOrder ??= basicWordOrderPicker(this.rng)()
  }
  config(): Readonly<Syntax> {
    return this.syntax
  }
}

/*
distribution stuff pulled out
*/

const auxiliaryVerbCount = pickMeToo([
  // pulled out of hat
  [3, 10],
  [4, 40],
  [5, 60],
  [6, 80],
  [7, 95],
  [8, 100],
  [9, 90],
  [10, 50],
])

const adverbialCountMaker = pickMeToo([
  [0, 50],
  [1, 2],
  [2, 1],
])

const auxiliaryCountMaker = pickMeToo([
  // mostly arbitrary
  [6, 1],
  [7, 2],
  [8, 4],
  [9, 8],
  [10, 16],
])

// loosely taken from https://en.wikipedia.org/wiki/Linguistic_typology#Syntactic_typology

const OVAdpositionOrderPicker = pickMeToo<RelativeOrder>([
  ['before', 1],
  ['after', 6],
])

const VOAdpositionOrderPicker = pickMeToo<RelativeOrder>([
  ['before', 6],
  ['after', 1],
])

const nonconfigurationalAdpositionOrderPicker = pickMeToo<RelativeOrder>([
  ['before', 4],
  ['after', 1],
])

// from https://wals.info/chapter/87
const modifierPositionPicker = pickMeToo<RelativeOrder>([
  ['before', 1],
  ['after', 2],
])

const basicWordOrderPicker = pickMeToo<BasicWordOrder>([
  ['SOV', 565],
  ['SVO', 488],
  ['VSO', 95],
  ['VOS', 25],
  ['OVS', 11],
  ['OSV', 4],
  ['Unfixed', 189],
])

// assume most verbs are used intransitively, ditransitives are rare
const argumentCountPickerSubjectNotRequired = pickMeToo([
  [0, 12],
  [1, 12],
  [2, 8],
  [3, 1],
])

const argumentCountPickerSubjectIsRequired = pickMeToo([
  [1, 12],
  [2, 8],
  [3, 1],
])

const questionParticlePositionPickerInitial = pickMeToo<DiscourseParticlePosition>([
  ['initial', 10],
  ['final', 2],
  ['none', 1],
])

const questionParticlePositionPickerFinal = pickMeToo<DiscourseParticlePosition>([
  ['initial', 2],
  ['final', 10],
  ['none', 1],
])

const questionParticlePositionPickerNone = pickMeToo<DiscourseParticlePosition>([
  ['initial', 3],
  ['final', 2],
  ['none', 5],
])

// very arbitrary
const questionParticleCountPicker = pickMeToo([
  [1, 4],
  [2, 2],
  [3, 1],
])

// very arbitrary
const assertionParticleCountPicker = pickMeToo([
  [1, 16],
  [2, 8],
  [3, 4],
  [4, 2],
  [5, 1],
])

// also arbitrary
const assertionParticlePositionPicker = pickMeToo<DiscourseParticlePosition>([
  ['initial', 1],
  ['final', 10],
  ['none', 20],
])

// and also arbitrary
const sententialParticleCountPicker = pickMeToo([
  [1, 50],
  [2, 10],
  [3, 3],
  [4, 2],
  [5, 1],
])
