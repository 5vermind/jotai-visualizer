import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const release = join(root, 'release')
const consumer = await mkdtemp(join(tmpdir(), 'jotai-visualizer-consumer-'))
const source = join(consumer, 'src')
await mkdir(source, { recursive: true })

const tarball = (name) => `file:${join(release, `jotai-visualizer-${name}-0.1.0.tgz`)}`
const localPackages = {
  '@jotai-visualizer/core': tarball('core'),
  '@jotai-visualizer/ui': tarball('ui'),
  '@jotai-visualizer/react': tarball('react'),
  '@jotai-visualizer/babel-plugin': tarball('babel-plugin'),
  '@jotai-visualizer/vite': tarball('vite'),
}

const manifest = {
  name: 'jotai-visualizer-release-consumer',
  version: '0.0.0',
  private: true,
  type: 'module',
  scripts: {
    build: 'tsc --noEmit && vite build',
  },
  dependencies: {
    ...localPackages,
    jotai: '2.20.2',
    react: '19.2.8',
    'react-dom': '19.2.8',
  },
  devDependencies: {
    '@types/react': '19.2.18',
    '@types/react-dom': '19.2.4',
    '@vitejs/plugin-react': '4.7.0',
    typescript: '5.9.3',
    vite: '6.4.3',
  },
  pnpm: {
    overrides: localPackages,
    onlyBuiltDependencies: ['esbuild'],
  },
}

await writeFile(join(consumer, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await writeFile(
  join(consumer, 'index.html'),
  '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
)
await writeFile(
  join(consumer, 'tsconfig.json'),
  `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: ['vite/client'],
      },
      include: ['src', 'vite.config.ts'],
    },
    null,
    2,
  )}\n`,
)
await writeFile(
  join(consumer, 'vite.config.ts'),
  `import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import jotaiVisualizer from '@jotai-visualizer/vite'

export default defineConfig({ plugins: [jotaiVisualizer(), react()] })
`,
)
await writeFile(
  join(source, 'App.tsx'),
  `import { atom, useAtom } from 'jotai'

export const countAtom = atom(0)
countAtom.debugLabel = 'countAtom'

export function App() {
  const [count, setCount] = useAtom(countAtom)
  return <button onClick={() => setCount((value) => value + 1)}>{count}</button>
}
`,
)
await writeFile(
  join(source, 'DevRoot.tsx'),
  `import {
  JotaiGraphCollector,
  JotaiVisualizer,
  RuntimeGraphProvider,
  createRuntimeGraph,
} from '@jotai-visualizer/react'
import { App } from './App.js'

const runtime = createRuntimeGraph()

export function DevRoot() {
  return (
    <RuntimeGraphProvider runtime={runtime}>
      <JotaiGraphCollector />
      <App />
      <JotaiVisualizer />
    </RuntimeGraphProvider>
  )
}
`,
)
await writeFile(
  join(source, 'main.tsx'),
  `import { createRoot } from 'react-dom/client'
import { App } from './App.js'

const root = createRoot(document.getElementById('root')!)
if (import.meta.env.DEV) {
  void import('./DevRoot.js').then(({ DevRoot }) => root.render(<DevRoot />))
} else {
  root.render(<App />)
}
`,
)

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: consumer,
    env: process.env,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    throw new Error(`${command} ${args.join(' ')} failed in consumer fixture`)
  }
}

run('pnpm', ['install', '--no-frozen-lockfile'])
run('pnpm', ['build'])

const productionFiles = await readdirRecursive(join(consumer, 'dist'))
for (const file of productionFiles.filter((path) => /\.(?:css|js)$/.test(path))) {
  const content = await readFile(file, 'utf8')
  if (/data-jotai-visualizer|useTrackedAtom|react-flow__/.test(content)) {
    throw new Error(`Consumer production artifact includes Visualizer marker: ${file}`)
  }
}

const server = spawn(
  'pnpm',
  ['exec', 'vite', '--host', '127.0.0.1', '--port', '5199', '--strictPort'],
  { cwd: consumer, env: process.env, stdio: 'ignore' },
)

try {
  let transformed = ''
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:5199/src/App.tsx')
      if (response.ok) {
        transformed = await response.text()
        break
      }
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (
    !transformed.includes('virtual:jotai-visualizer/runtime') ||
    !transformed.includes('src/App.tsx#App')
  ) {
    throw new Error('Consumer development source was not automatically instrumented')
  }
} finally {
  server.kill('SIGTERM')
  await rm(consumer, { recursive: true, force: true })
}

console.log('Verified tarball install, types, dev instrumentation, and production build.')

async function readdirRecursive(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? readdirRecursive(path) : [path]
    }),
  )
  return nested.flat()
}
