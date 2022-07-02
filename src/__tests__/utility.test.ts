import { combinations, compact } from '../util'

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
