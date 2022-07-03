import { capitalize, combinations, compact, subsets, titleize } from '../util'

describe('compact', () => {
  test('gets rid of both null and undefined', () => expect(compact([1, null, 2, undefined])).toEqual([1, 2]))
})

describe('combinations', () => {
  test('doc example works', () =>
    expect(
      combinations([
        [1, 2],
        [3, 4],
        [5, 6],
      ]),
    ).toEqual([
      [1, 3, 5],
      [1, 3, 6],
      [1, 4, 5],
      [1, 4, 6],
      [2, 3, 5],
      [2, 3, 6],
      [2, 4, 5],
      [2, 4, 6],
    ]))
})

describe('capitalize', () => {
  test('foo', () => expect(capitalize('foo')).toEqual('Foo'))
  test('foo bar', () => expect(capitalize('foo bar')).toEqual('Foo bar'))
  test('Foo', () => expect(capitalize('Foo')).toEqual('Foo'))
})

describe('titleize', () => {
  test('foo', () => expect(titleize('foo')).toEqual('Foo'))
  test('foo bar', () => expect(titleize('foo bar')).toEqual('Foo Bar'))
  test(' foo  bar ', () => expect(titleize(' foo  bar ')).toEqual(' Foo  Bar '))
  test('foo Bar', () => expect(titleize('foo Bar')).toEqual('Foo Bar'))
})

describe('subsets', () => {
  const set = [1, 2, 3]
  const ssets = subsets(set).sort((a, b) => {
    const l = a.length - b.length
    if (l) return l
    for (let i = 0; i < a.length; i++) {
      if (a[i] < b[i]) return -1
      if (b[i] < a[i]) return 1
    }
    return 0
  })
  test('[1, 2, 3', () => expect(ssets).toEqual([[1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]))
})
