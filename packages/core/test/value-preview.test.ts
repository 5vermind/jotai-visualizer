import { describe, expect, it } from 'vitest'

import { createValuePreview } from '../src/index.js'

const context = {
  atomLabel: 'valueAtom',
  nodeId: 'store:1/atom:1',
  storeId: 'store:1',
}
const enabled = { enabled: true }

describe('value preview compatibility', () => {
  it('serializes Error, Promise, Map, and Set values', () => {
    expect(createValuePreview(new Error('failed'), context, enabled)).toBe(
      'Error: failed',
    )
    expect(
      createValuePreview(Promise.resolve('done'), context, enabled),
    ).toBe('[Promise]')
    expect(
      createValuePreview(
        new Map<string, unknown>([
          ['count', 2],
          ['nested', new Set(['a', 'b'])],
        ]),
        context,
        enabled,
      ),
    ).toBe(
      'Map(2) [["count",2],["nested",{"$type":"Set","values":["a","b"]}]]',
    )
    expect(createValuePreview(new Set([1, 2, 3]), context, enabled)).toBe(
      'Set(3) [1,2,3]',
    )
  })

  it('handles circular collections without throwing', () => {
    const map = new Map<string, unknown>()
    map.set('self', map)
    const set = new Set<unknown>()
    set.add(set)

    expect(createValuePreview(map, context, enabled)).toBe(
      'Map(1) [["self","[Circular]"]]',
    )
    expect(createValuePreview(set, context, enabled)).toBe(
      'Set(1) ["[Circular]"]',
    )
  })
})
