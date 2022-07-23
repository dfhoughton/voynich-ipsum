import { pickMe, pickMeToo, rando, Rng } from 'pick-me-too'
import { Morphology, MorphologyEngine } from './morphology'
import { Phonology, PhonologyEngine } from './phonology'
import { Syntax, SyntaxEngine } from './syntax'
import { Hmm, titleize } from './util'

export type LanguageParams = {
  seed?: number
  name?: string
  phonology?: Phonology
  morphology?: Morphology
  syntax?: Syntax
  rngGenerator?: (seed: number) => Rng
}

/**
 * A generator of gibberish.
 */
export class Language {
  /**
   * The language's phonology engine.
   */
  phonology: Readonly<PhonologyEngine>
  /**
   * The language's morophology engine.
   */
  morphology: Readonly<MorphologyEngine>
  /**
   * The language's syntactic engine.
   */
  syntax: Readonly<SyntaxEngine>
  /**
   * The name of the language in the language itself.
   */
  name: Readonly<string>
  private rng: Rng
  private sentenceCount: () => number
  private sentenceType: () => string
  private topicCount: () => number
  private subtopicCount: () => number
  /**
   * Creates an instance of language.
   * @param [{ seed, name, phonology, morphology, syntax, rngGenerator }] 
   */
  constructor({ seed, name, phonology, morphology, syntax, rngGenerator }: LanguageParams = {}) {
    seed ??= Math.random() * 1000
    this.rng = (rngGenerator ?? rando)(seed)
    this.phonology = new PhonologyEngine(phonology, this.rng)
    this.morphology = new MorphologyEngine(this.phonology, morphology, this.rng)
    this.syntax = new SyntaxEngine(this.morphology, syntax, this.rng)
    this.name = name ?? titleize(this.syntax.nounPhrase())
    this.sentenceCount = sentenceCount(this.rng)
    this.sentenceType = sentenceType(this.rng)
    this.topicCount = topicCount(this.rng)
    this.subtopicCount = subtopicCount(this.rng)
  }
  /**
   * Makes a complete sentence asserting a proposition, such as "My feet are cold.",
   * "So it is.", "Tomorrow and tomorrow and tomorrow creeps in this petty pace from day to day
   * to the last syllable of recorded time, and all our yesterdays have lighted fools the way to
   * dusty death.", and so forth.
   * 
   * @param topics - noun stems 
   * @returns assertion 
   */
  assertion(...topics: string[]): string {
    return this.syntax.assertion(...topics)
  }
  /**
   * Makes a complete sentence expression a question, such as "Do you want cheese?",
   * "Why me?", "Whose cousin are you again?", and so forth.
   * 
   * @param topics - noun stems 
   * @returns question 
   */
  question(...topics: string[]): string {
    return this.syntax.question(...topics)
  }
  /**
   * Makes a complete sentence expression an exclamation, such as "Begone, foul demon of the pit!",
   * "Not on my life!", "Bless your soul!", and so forth.
   * 
   * @param topics - noun stems 
   * @returns exclamation 
   */
  exclamation(...topics: string[]): string {
    return this.syntax.exclamation(...topics)
  }
  /**
   * Makes a random noun phrase, such as "the fat cat", "Ricardo", or "hemorrhagic fever".
   * 
   * @param [topic] - a noun stem
   * @returns phrase 
   */
  nounPhrase(topic?: string): string {
    return this.syntax.nounPhrase(topic)
  }
  private makeTopics(max?: number): string[] {
    const ar = []
    const seen = new Set()
    let n = this.topicCount()
    if (max && max < n) n = max
    while (ar.length < n) {
      const topic = this.morphology.nounStem()
      if (!seen.has(topic)) {
        seen.add(topic)
        ar.push(topic)
      }
    }
    return ar
  }
  /**
   * Makes a collection of sentences on a consistent set of topics.
   * @param [topics] - a set of noun stems
   * @returns paragraph 
   */
  paragraph(topics?: string[]): string {
    topics ??= this.makeTopics(4)
    let lim = 2 // the maximum number of topics per sentence
    if (lim > topics.length) lim = topics.length
    const frequencies: [string | undefined, number][] = []
    for (const t of topics) frequencies.push([t, this.rng()])
    let sum = 0
    for (const [, n] of frequencies) sum += n
    frequencies.push([undefined, sum * 2]) // only every third topic is an existing topic
    const topicPicker = pickMe(frequencies, this.rng)
    const sentenceCount = this.sentenceCount()
    const sentences: string[] = []
    for (let i = 0; i < sentenceCount; i++) {
      topics = []
      for (let j = 0; j < lim; j++) {
        const t = topicPicker()
        if (t && t !== topics[0]) topics.push(t)
      }
      switch (this.sentenceType()) {
        case 'assertion':
          sentences.push(this.assertion(...topics))
          break
        case 'question':
          sentences.push(this.question(...topics))
          break
        case 'exclamation':
          sentences.push(this.exclamation(...topics))
          break
      }
    }
    return sentences.join(' ')
  }
  /**
   * Makes a few paragraphs of text on a consistent set of topics.
   *
   * @param [paragraphs] - the number of paragraphs sought; if no number is provided, a random number between 3 and 15 is chosen
   * @param [topics] - a set of noun stems
   * @returns essay
   */
  essay(paragraphs?: number, topics?: string[]): string {
    paragraphs ??= Math.round(new Hmm(this.rng).fromRange(3, 15))
    if (paragraphs < 1) throw 'an essay must have a positive number of paragraphs'
    topics ??= this.makeTopics()
    const frequencies: [string, number][] = []
    for (const t of topics) frequencies.push([t, this.rng()])
    const topicPicker = pickMe(frequencies, this.rng)
    const text: string[] = []
    for (let j = 0; j < paragraphs; j++) {
      const subtopics: string[] = []
      const seen = new Set()
      let lim = this.subtopicCount()
      if (lim > topics.length) lim = topics.length
      for (let k = 0; k < lim; k++) {
        const t = topicPicker()
        if (!seen.has(t)) {
          seen.add(t)
          subtopics.push(t)
        }
      }
      text.push(this.paragraph(subtopics))
    }
    return text.join('\n\n')
  }
  /**
   * Randomly resets the seed of the random number generator to make
   * the next text produced unpredictable.
   */
  scramble() {
    ;(this.rng as any)(Math.random())
  }
  /**
   * Produces the parameters the *linguistic* parameters of this language.
   * Only configurable parameters are returned.
   *
   * If you find a language with a syntax that suits you, or partially suits you,
   * you can use this to obtain the configuration, tinker with it, and apply it to other languages.
   *
   * Note, the configuration should be regarded as read-only. In any case, if you modify the configuration
   * it will have no effect on the engine. The configuration parameters are only used during initialization.
   *
   * @returns language configuration
   */
  config(): Readonly<LanguageParams> {
    return {
      phonology: this.phonology.config(),
      morphology: this.morphology.config(),
      syntax: this.syntax.config(),
    }
  }
}

/*
to the extent possible we do the expensive part of working with probability distributions
at load time
*/

// frequencies extracted from a few NYT articles
const sentenceCount = pickMeToo([
  [1, 36],
  [2, 60],
  [3, 22],
  [4, 10],
  [5, 4],
  [6, 1], // added
  [7, 1], // added
  [8, 1], // added
  [9, 1],
  [10, 1], // added
  [11, 1],
])

// from the same articles
const sentenceType = pickMeToo([
  ['assertion', 291],
  ['exclamation', 4],
  ['question', 7],
])

// topics per essay
const topicCount = pickMeToo([
  // arbitrary
  [1, 15],
  [2, 20],
  [3, 35],
  [4, 40],
  [5, 30],
  [6, 20],
  [7, 10],
  [8, 5],
  [9, 3],
  [10, 2],
  [11, 1],
  [12, 1],
])

// topics per paragraph
const subtopicCount = pickMeToo([
  // arbitrary
  [1, 1],
  [2, 4],
  [3, 8],
  [4, 10],
])
