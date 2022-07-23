import {Language} from '../language'

// we could use more tests, but hey! this is just a gibberish generator!

describe('language', () => {
  for (let i = 0; i < 10; i++) {
    const language = new Language({seed: i})
    // language.scramble()
    test('name', () => expect(language.name).toBeDefined())
    language.scramble()
    test('essay', () => expect(language.essay(5)).toBeDefined())
    test('assertion', () => expect(language.assertion('foo')).toBeDefined())
    test('question', () => expect(language.question('foo')).toBeDefined())
    test('exclamation', () => expect(language.exclamation('foo')).toBeDefined())
    test('nounPhrase', () => expect(language.nounPhrase('foo')).toMatch(/foo/i))
  }
})
