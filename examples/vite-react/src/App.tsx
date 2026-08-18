import { useAtom, useAtomValue } from 'jotai'

import { countAtom, countStatusAtom, doubledCountAtom } from './atoms.js'

function Counter() {
  const [count, setCount] = useAtom(countAtom)

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

function DerivedSummary() {
  const doubledCount = useAtomValue(doubledCountAtom)
  const status = useAtomValue(countStatusAtom)

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

export function App() {
  return (
    <main>
      <header className="hero">
        <p className="eyebrow">M0 development fixture</p>
        <h1>Jotai Visualizer</h1>
        <p>
          This app provides a small atom graph for validating runtime collection
          in the next milestone.
        </p>
      </header>
      <div className="grid">
        <Counter />
        <DerivedSummary />
      </div>
    </main>
  )
}
