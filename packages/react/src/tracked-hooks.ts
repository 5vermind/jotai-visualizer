import { useEffect } from 'react'

import {
  useAtom,
  useAtomValue,
  useSetAtom,
  useStore,
  type Atom,
  type PrimitiveAtom,
  type SetStateAction,
  type WritableAtom,
} from 'jotai'

import { useRuntimeGraph } from './runtime-context.js'
import type {
  ComponentMetadata,
  ConsumerAccess,
  JotaiStore,
} from './runtime-graph.js'

type StoreOptions = {
  store?: JotaiStore
}

type AtomValueOptions = StoreOptions & {
  delay?: number
  unstable_promiseStatus?: boolean
}

type SetAtom<Args extends unknown[], Result> = (...args: Args) => Result

const useConsumerRegistration = (
  atom: Atom<unknown>,
  component: ComponentMetadata,
  access: ConsumerAccess,
  options?: StoreOptions,
) => {
  const runtime = useRuntimeGraph()
  const store = useStore(options)

  useEffect(
    () => runtime.registerConsumer({ store, atom, component, access }),
    [
      access,
      atom,
      component.column,
      component.file,
      component.id,
      component.line,
      component.name,
      runtime,
      store,
    ],
  )
}

export function useTrackedAtom<Value, Args extends unknown[], Result>(
  atom: WritableAtom<Value, Args, Result>,
  component: ComponentMetadata,
  options?: AtomValueOptions,
): [Awaited<Value>, SetAtom<Args, Result>]
export function useTrackedAtom<Value>(
  atom: PrimitiveAtom<Value>,
  component: ComponentMetadata,
  options?: AtomValueOptions,
): [Awaited<Value>, SetAtom<[SetStateAction<Value>], void>]
export function useTrackedAtom<Value>(
  atom: Atom<Value>,
  component: ComponentMetadata,
  options?: AtomValueOptions,
): [Awaited<Value>, never]
export function useTrackedAtom(
  atom: Atom<unknown>,
  component: ComponentMetadata,
  options?: AtomValueOptions,
): [unknown, unknown] {
  const result = useAtom(atom, options)
  useConsumerRegistration(
    atom,
    component,
    'write' in atom ? 'read-write' : 'read',
    options,
  )
  return result
}

export function useTrackedAtomValue<Value>(
  atom: Atom<Value>,
  component: ComponentMetadata,
  options?: AtomValueOptions,
): Awaited<Value> {
  const value = useAtomValue(atom, options)
  useConsumerRegistration(atom, component, 'read', options)
  return value
}

export function useTrackedSetAtom<
  Value,
  Args extends unknown[],
  Result,
>(
  atom: WritableAtom<Value, Args, Result>,
  component: ComponentMetadata,
  options?: StoreOptions,
): SetAtom<Args, Result> {
  const setAtom = useSetAtom(atom, options)
  useConsumerRegistration(atom, component, 'write', options)
  return setAtom
}
