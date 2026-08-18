import { Provider, createStore } from 'jotai'

import {
  JotaiGraphCollector,
  JotaiVisualizer,
  RuntimeGraphProvider,
  createRuntimeGraph,
} from '@jotai-visualizer/react'

import { App } from './App.js'
import { countAtom } from './atoms.js'
import { BenchmarkRoot } from './BenchmarkRoot.js'

const runtime = createRuntimeGraph({
  valuePreview: {
    enabled: true,
    redact: (_value, { atomLabel }) =>
      /password|secret|token/i.test(atomLabel),
  },
})
const customStore = createStore()
customStore.set(countAtom, 10)

export function DevRoot() {
  if (new URLSearchParams(window.location.search).get('benchmark') === '500') {
    return <BenchmarkRoot />
  }

  return (
    <RuntimeGraphProvider runtime={runtime}>
      <JotaiGraphCollector />
      <JotaiVisualizer initialOpen />
      <main>
        <header className="hero">
          <p className="eyebrow">M4 automatic instrumentation fixture</p>
          <h1>Jotai Visualizer</h1>
          <p>
            The Vite plugin instruments ordinary Jotai hooks with component and
            source metadata during development.
          </p>
        </header>
        <App scope="Default store" />
        <Provider store={customStore}>
          <JotaiGraphCollector store={customStore} />
          <App scope="Custom store" />
        </Provider>
      </main>
    </RuntimeGraphProvider>
  )
}
