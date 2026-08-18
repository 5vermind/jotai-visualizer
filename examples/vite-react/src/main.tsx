import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.js'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element was not found')
}

const reactRoot = createRoot(root)

if (import.meta.env.DEV) {
  void import('./DevRoot.js').then(({ DevRoot }) => {
    reactRoot.render(
      <StrictMode>
        <DevRoot />
      </StrictMode>,
    )
  })
} else {
  reactRoot.render(
    <StrictMode>
      <main>
        <header className="hero">
          <p className="eyebrow">Production fixture</p>
          <h1>Jotai Example</h1>
          <p>The development visualizer is removed from this build.</p>
        </header>
        <App scope="Default store" />
      </main>
    </StrictMode>,
  )
}
