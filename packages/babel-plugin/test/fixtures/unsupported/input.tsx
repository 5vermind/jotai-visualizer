import * as Jotai from 'jotai'
import { useAtomValue } from 'jotai'

const countAtom = Jotai.atom(0)

export function useCount() {
  return useAtomValue(countAtom)
}

export function Counter() {
  return Jotai.useAtom(countAtom)[0]
}
