import { atom } from 'jotai'

export const countAtom = atom(0)
countAtom.debugLabel = 'countAtom'

export const doubledCountAtom = atom((get) => get(countAtom) * 2)
doubledCountAtom.debugLabel = 'doubledCountAtom'

export const countStatusAtom = atom((get) => {
  const count = get(countAtom)
  return count === 0 ? 'idle' : count > 0 ? 'positive' : 'negative'
})
countStatusAtom.debugLabel = 'countStatusAtom'

export const privateDiagnosticsAtom = atom((get) => ({
  count: get(countAtom),
  source: 'internal',
}))
privateDiagnosticsAtom.debugLabel = 'privateDiagnosticsAtom'
privateDiagnosticsAtom.debugPrivate = true
