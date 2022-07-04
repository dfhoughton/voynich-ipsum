# voynich-ipsum
Generate non-latinate random text from a conlang.

## Summary

`voynich-ipsum` gives you a constructed language generator. You can specify various properties of the language -- it is synthetic
or analytic; it is VSO or SVO or OSV; it has a simple or complex phoneme inventoty; etc. -- or leave this up to chance. The language
is defined by the settings of various parameters and the construction of various probability distributions during instantiation. After
this it has a fixed name and properties. You can ask it to generate random text with our without a list of topics.

Mostly this is intended as a replacement for boring, repetitive Lorem ipsum text.

## Why "voynich-ipsum"?

The [Voynich Manuscript](https://en.wikipedia.org/wiki/Voynich_manuscript) is a famous example of a text that is maybe real, maybe a fraud.
Examining the statistical properties of the characters, words, and structure of the text suggests mostly that is has the structure of a real
language, but not entirely, and any affiliation with an existing language and/or writing system is still up in the air.

The aim with `voynich-ipsum` is to generate explicitly fake languages with the same properties. The code incorporates many real linguistic
properties to produce a patina of plausibility for text that means nothing at all.

## Synopsis

```typescript
import { Language } from 'voynich-ipsum'

const lang = new Language({seed: 1})
console.log(lang.name)
// => Ekogo

// produce a 5-paragraph essay on a random topic
console.log(lang.essay(5))
// => 
// Ezozsebe azeghi ze. Ghoxeexl sedgog ghudlsooz. Ghodoghi aso akuoed do buoghupe.
//
// Saxeexl zaib adiupu.
//
// Uea ghuzazseu.
//
// Kakoko uvbnsu. Kakoko ghudili. Akoko zo e ghuipu be.
//
// Kakoko ghusodobabo. Sazope aakupo.

// assert something about 'foo'
console.log(lang.assertion('foo'))
// => Ufoo adiode.

// ask a question about 'foo'
console.log(lang.question('foo'))
// => Efoo ovde?

// shout something about 'foo'
console.log(lang.exclamation('foo'))
// => Foo doeeavuzl zeze!

// a phrase concerning foo
console.log(lang.nounPhrase('foo'))
// => afoo
```

## Caveats

The choices in here are based in some cases on published research in linguistic typology, sometimes in statistics I scraped out of
random text I found on the Internet, and most often out of plausible-seeming numbers I pulled out of my ass. There is a *vast* amount
of linguistic variation I have not covered. This does not produce ergative-absolutive languages (or nominative-accusative languages,
for that matter). It does not know about vowel harmony. It can't produce languages with tone, or nasal vowels. It can't do noun class
agreement between nouns and adjectives. It doesn't really know about adjectives at all. It produces phonemes that were easy to produce
with a mostly latinate character set. It has no variation in orthography. It never produces a right-to-left language. Etc. Etc. Etc.

I had great ambitions for covering typological variables and gave up on most of them because I'm lazy and my attention wanders.