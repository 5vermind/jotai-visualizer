import { atom, useAtom as useCount, useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'

const countAtom = atom(0)

export const Counter = () => {
  const [count, setCount] = useCount(countAtom)
  useEffect(() => undefined, [])
  const value = useAtomValue(countAtom, { delay: 10 })
  const setValue = useSetAtom(countAtom)
  return (
    <button
      onClick={() => setCount((current) => current + 1)}
      onDoubleClick={() => setValue(count + value)}
    >
      {count}
    </button>
  )
}
