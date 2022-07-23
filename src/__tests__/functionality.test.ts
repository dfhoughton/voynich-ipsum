import {PhonologyEngine} from '../phonology'
import {MorphologyEngine} from '../morphology'
import {SyntaxEngine} from '../syntax'
import { pickMe, pickMeToo, rando } from 'pick-me-too'
import {Language} from '../language'

// describe('phonology engine', () => {
  // const params = {}
  // let pe = new PhonologyEngine(params, () => Math.random())
  // const counter: Record<string ,number> = {}
  // for(let i = 0; i < 1000; i++) {
  //   const n = pe.syllable()
  //   const count = (counter[n] ?? 0) + 1
  //   counter[n] = count
  // }
  // const demo: Record<string ,number> = {}
  // for (const [k, v ] of Object.entries(counter).map(e => e).sort((([, va], [, vb]) => va - vb))) {
  //   demo[k] = v
  // }
  // console.log(demo)
  // console.log({config: pe.config()})
  // test('stubbed', () => expect(true).toEqual(true))
// })

// describe('morphology engine', () => {
  // const params = {}
  // let pe = new PhonologyEngine(params, () => Math.random())
  // let me = new MorphologyEngine(pe, params, () => Math.random())
  // console.log('pronoun', me.pronoun())
  // console.log('noun', me.noun())
  // console.log('verb', me.verb())
  // console.log('adverb', me.adverb())
  // console.log('particle', me.particle())
  // console.log('config', me.config())
// })

// describe('syntax engine', () => {
  // const params = {}
  // let pe = new PhonologyEngine(params, () => Math.random())
  // let me = new MorphologyEngine(pe, params, () => Math.random())
  // let se = new SyntaxEngine(me, params, () => Math.random())
  // console.log('assertion', se.assertion())
  // console.log('exclamation', se.exclamation())
  // console.log('question', se.question())
  // for (let i = 0; i < 200; i++) {
  //   const rng = rando(i)
  //   pe = new PhonologyEngine({}, rng)
  //   me = new MorphologyEngine(pe, {}, rng)
  //   se = new SyntaxEngine(me, {}, rng)
  //   console.log(i, se.assertion())
  // }
// })


describe('language', () => {
  for (let i = 0; i < 2; i++) {
    const language = new Language({seed: i})
    // language.scramble()
    console.log('name', language.name)
    test('name', () => expect(language.name).toBeDefined())
    language.scramble()
    console.log(language.essay(5))
    console.log(language.assertion('foo'))
    console.log(language.question('foo'))
    console.log(language.exclamation('foo'))
    console.log(language.nounPhrase('foo'))
  }
})
