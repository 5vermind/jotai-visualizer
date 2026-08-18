import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const required = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing compatibility version environment variable: ${name}`)
  }
  return value
}

const versions = {
  react: required('COMPAT_REACT'),
  'react-dom': required('COMPAT_REACT_DOM'),
  '@types/react': required('COMPAT_TYPES_REACT'),
  '@types/react-dom': required('COMPAT_TYPES_REACT_DOM'),
  jotai: required('COMPAT_JOTAI'),
  vite: required('COMPAT_VITE'),
  '@vitejs/plugin-react': required('COMPAT_VITE_REACT'),
}

const packageFiles = ['package.json']
for (const parent of ['packages', 'examples']) {
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      packageFiles.push(join(parent, entry.name, 'package.json'))
    }
  }
}

let updates = 0
for (const file of packageFiles) {
  const manifest = JSON.parse(await readFile(file, 'utf8'))
  for (const section of ['dependencies', 'devDependencies']) {
    const dependencies = manifest[section]
    if (!dependencies) {
      continue
    }
    for (const [name, version] of Object.entries(versions)) {
      if (dependencies[name] && dependencies[name] !== version) {
        dependencies[name] = version
        updates += 1
      }
    }
  }
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`)
}

console.log(
  `Applied ${updates} dependency updates for React ${versions.react}, Jotai ${versions.jotai}, Vite ${versions.vite}.`,
)
