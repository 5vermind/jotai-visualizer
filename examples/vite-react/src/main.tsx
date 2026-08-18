import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider, createStore } from 'jotai'

import {
  JotaiGraphCollector,
  JotaiVisualizer,
  RuntimeGraphProvider,
  createRuntimeGraph,
} from '@jotai-visualizer/react'

import { App } from './App.js'
import { countAtom } from './atoms.js'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element was not found')
}

const runtime = createRuntimeGraph({
  valuePreview: {
    enabled: true,
    redact: (_value, { atomLabel }) =>
      /password|secret|token/i.test(atomLabel),
  },
})
const customStore = createStore()
customStore.set(countAtom, 10)

createRoot(root).render(
  <StrictMode>
    <RuntimeGraphProvider runtime={runtime}>
      <JotaiGraphCollector />
      <JotaiVisualizer initialOpen />
      <main>
        <header className="hero">
          <p className="eyebrow">M3 embedded visualizer fixture</p>
          <h1>Jotai Visualizer</h1>
          <p>
            Use the embedded panel to inspect live atoms, dependencies, and
            component consumers across isolated Stores.
          </p>
        </header>
        <App scope="Default store" />
        <Provider store={customStore}>
          <JotaiGraphCollector store={customStore} />
          <App scope="Custom store" />
        </Provider>
      </main>
    </RuntimeGraphProvider>
  </StrictMode>,
)
