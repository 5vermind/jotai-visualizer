import { execFileSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const releaseDirectory = fileURLToPath(new URL('../release/', import.meta.url))
const expectedPackages = new Set([
  '@jotai-visualizer/babel-plugin',
  '@jotai-visualizer/core',
  '@jotai-visualizer/react',
  '@jotai-visualizer/ui',
  '@jotai-visualizer/vite',
])
const tarballs = (await readdir(releaseDirectory))
  .filter((file) => file.endsWith('.tgz'))
  .sort()

if (tarballs.length !== expectedPackages.size) {
  throw new Error(`Expected ${expectedPackages.size} tarballs, found ${tarballs.length}`)
}

for (const tarball of tarballs) {
  const path = `${releaseDirectory}/${tarball}`
  const entries = execFileSync('tar', ['-tzf', path], { encoding: 'utf8' })
    .trim()
    .split('\n')
  const forbidden = entries.filter((entry) =>
    /(?:^|\/)(?:src|test|node_modules)(?:\/|$)|tsconfig|\.map\.ts$/.test(entry),
  )
  if (forbidden.length > 0) {
    throw new Error(`${tarball} contains forbidden files: ${forbidden.join(', ')}`)
  }
  for (const required of [
    'package/package.json',
    'package/README.md',
    'package/LICENSE',
    'package/dist/index.js',
    'package/dist/index.d.ts',
  ]) {
    if (!entries.includes(required)) {
      throw new Error(`${tarball} is missing ${required}`)
    }
  }

  const manifest = JSON.parse(
    execFileSync('tar', ['-xOzf', path, 'package/package.json'], {
      encoding: 'utf8',
    }),
  )
  if (!expectedPackages.delete(manifest.name)) {
    throw new Error(`${tarball} has unexpected package name ${manifest.name}`)
  }
  if (manifest.version !== '0.1.0') {
    throw new Error(`${manifest.name} has unexpected version ${manifest.version}`)
  }
  if (manifest.private) {
    throw new Error(`${manifest.name} is still private`)
  }
  if (JSON.stringify(manifest).includes('workspace:')) {
    throw new Error(`${manifest.name} still contains workspace protocol dependencies`)
  }
  if (manifest.exports?.['.']?.import !== './dist/index.js') {
    throw new Error(`${manifest.name} does not export dist/index.js`)
  }
  if (
    manifest.name === '@jotai-visualizer/ui' &&
    !entries.includes('package/dist/styles.css')
  ) {
    throw new Error('@jotai-visualizer/ui is missing dist/styles.css')
  }
}

if (expectedPackages.size > 0) {
  throw new Error(`Missing packages: ${[...expectedPackages].join(', ')}`)
}

console.log(`Verified ${tarballs.length} publishable tarballs at version 0.1.0.`)
