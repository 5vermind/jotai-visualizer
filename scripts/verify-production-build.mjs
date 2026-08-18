import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outputDirectory = fileURLToPath(
  new URL('../examples/vite-react/dist/', import.meta.url),
)
const markers = [
  'data-jotai-visualizer',
  'useTrackedAtom',
  'virtual:jotai-visualizer',
  'react-flow__',
  'Private atoms',
]

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? collectFiles(path) : [path]
    }),
  )
  return files.flat()
}

const files = (await collectFiles(outputDirectory)).filter((file) =>
  ['.css', '.html', '.js'].includes(extname(file)),
)

if (files.length === 0) {
  throw new Error('Production example build has no inspectable artifacts')
}

for (const file of files) {
  const content = await readFile(file, 'utf8')
  const marker = markers.find((candidate) => content.includes(candidate))
  if (marker) {
    throw new Error(`Production artifact ${file} contains ${marker}`)
  }
}

console.log(
  `Verified ${files.length} production artifacts without visualizer instrumentation.`,
)
