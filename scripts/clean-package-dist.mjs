import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const dist = resolve(process.cwd(), 'dist')
await rm(dist, { recursive: true, force: true })
