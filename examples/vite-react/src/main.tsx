import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider, createStore } from 'jotai'

import {
  GraphSnapshotLogger,
  JotaiGraphCollector,
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

const runtime = createRuntimeGraph()
const customStore = createStore()
customStore.set(countAtom, 10)

createRoot(root).render(
  <StrictMode>
    <RuntimeGraphProvider runtime={runtime}>
      <JotaiGraphCollector />
      <GraphSnapshotLogger />
      <main>
        <header className="hero">
          <p className="eyebrow">M1 runtime feasibility fixture</p>
          <h1>Jotai Visualizer</h1>
          <p>
            Open the browser console to inspect the live atom, dependency, and
            component consumer graph as JSON.
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
