import { mkdir, readdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const releaseDirectory = fileURLToPath(new URL('../release/', import.meta.url))
const packagesDirectory = fileURLToPath(new URL('../packages/', import.meta.url))

await rm(releaseDirectory, { recursive: true, force: true })
await mkdir(releaseDirectory, { recursive: true })

for (const entry of await readdir(packagesDirectory, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue
  }
  const packageDirectory = `${packagesDirectory}/${entry.name}`
  const result = spawnSync(
    'pnpm',
    ['pack', '--pack-destination', releaseDirectory],
    {
      cwd: packageDirectory,
      stdio: 'inherit',
      env: process.env,
    },
  )
  if (result.status !== 0) {
    throw new Error(`Failed to pack packages/${entry.name}`)
  }
}

const tarballs = (await readdir(releaseDirectory))
  .filter((file) => file.endsWith('.tgz'))
  .sort()

if (tarballs.length !== 5) {
  throw new Error(`Expected 5 release tarballs, found ${tarballs.length}`)
}

console.log(`Packed ${tarballs.length} packages in ${releaseDirectory}`)
console.log(tarballs.map((file) => `- release/${file}`).join('\n'))
console.log(`Workspace root: ${root}`)
