import {
  useTrackedAtom,
  useTrackedAtomValue,
} from '@jotai-visualizer/react'

import {
  countAtom,
  countStatusAtom,
  doubledCountAtom,
  privateDiagnosticsAtom,
} from './atoms.js'

function InternalDiagnostics({ scope }: { scope: string }) {
  useTrackedAtomValue(privateDiagnosticsAtom, {
    id: `src/App.tsx#${scope}InternalDiagnostics`,
    name: `${scope} InternalDiagnostics`,
    file: 'examples/vite-react/src/App.tsx',
  })
  return null
}

function Counter({ scope }: { scope: string }) {
  const [count, setCount] = useTrackedAtom(countAtom, {
    id: `src/App.tsx#${scope}Counter`,
    name: `${scope} Counter`,
    file: 'examples/vite-react/src/App.tsx',
  })

  return (
    <section className="card" aria-labelledby="counter-title">
      <div>
        <p className="eyebrow">Primitive atom consumer</p>
        <h2 id="counter-title">Counter</h2>
      </div>
      <output className="count" aria-live="polite">
        {count}
      </output>
      <div className="actions">
        <button type="button" onClick={() => setCount((value) => value - 1)}>
          Decrease
        </button>
        <button type="button" onClick={() => setCount(0)}>
          Reset
        </button>
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          Increase
        </button>
      </div>
    </section>
  )
}

function DerivedSummary({ scope }: { scope: string }) {
  const doubledCount = useTrackedAtomValue(doubledCountAtom, {
    id: `src/App.tsx#${scope}DerivedSummary`,
    name: `${scope} DerivedSummary`,
    file: 'examples/vite-react/src/App.tsx',
  })
  const status = useTrackedAtomValue(countStatusAtom, {
    id: `src/App.tsx#${scope}DerivedSummary`,
    name: `${scope} DerivedSummary`,
    file: 'examples/vite-react/src/App.tsx',
  })

  return (
    <section className="card" aria-labelledby="summary-title">
      <div>
        <p className="eyebrow">Derived atom consumers</p>
        <h2 id="summary-title">Runtime summary</h2>
      </div>
      <dl className="summary">
        <div>
          <dt>Doubled</dt>
          <dd>{doubledCount}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{status}</dd>
        </div>
      </dl>
    </section>
  )
}

export function App({ scope }: { scope: string }) {
  const scopeId = scope.toLowerCase().replaceAll(' ', '-')

  return (
    <section className="scope" aria-labelledby={`${scopeId}-title`}>
      <InternalDiagnostics scope={scope} />
      <div className="scope-heading">
        <p className="eyebrow">Independent Jotai state scope</p>
        <h2 id={`${scopeId}-title`}>{scope}</h2>
      </div>
      <div className="grid">
        <Counter scope={scope} />
        <DerivedSummary scope={scope} />
      </div>
    </section>
  )
}
