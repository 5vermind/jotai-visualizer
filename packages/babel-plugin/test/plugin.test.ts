import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { transformSync } from '@babel/core'
import { describe, expect, it } from 'vitest'

import jotaiVisualizerBabelPlugin, {
  type JotaiVisualizerMetadata,
} from '../src/index.js'

const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}/input.tsx`, import.meta.url)),
    'utf8',
  )

const transform = (code: string, filename: string) =>
  transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [
      [
        jotaiVisualizerBabelPlugin,
        {
          root: '/project',
          runtimeModule: 'virtual:jotai-visualizer/runtime',
          hmr: true,
        },
      ],
    ],
  })

describe('jotai visualizer Babel plugin', () => {
  it('transforms all supported hooks, aliases, metadata, HMR, and source maps', () => {
    const result = transform(fixture('basic'), '/project/src/Counter.tsx')
    const code = result?.code ?? ''
    const metadata = (result?.metadata as Record<string, unknown> | undefined)
      ?.jotaiVisualizer as JotaiVisualizerMetadata

    expect(metadata).toEqual({ diagnostics: [], transformedCalls: 3 })
    expect(code).toContain('useTrackedAtom as _useTrackedAtom')
    expect(code).toContain('useTrackedAtomValue as _useTrackedAtomValue')
    expect(code).toContain('useTrackedSetAtom as _useTrackedSetAtom')
    expect(code).toContain('registerVisualizerModule')
    expect(code).toContain('src/Counter.tsx#Counter')
    expect(code).toContain('file: "src/Counter.tsx"')
    expect(code).toContain('_useTrackedAtomValue(countAtom, {')
    expect(code).toContain('}, {\n    delay: 10\n  })')
    expect(code.indexOf('_useTrackedAtom(countAtom')).toBeLessThan(
      code.indexOf('useEffect(() => undefined'),
    )
    expect(code.indexOf('useEffect(() => undefined')).toBeLessThan(
      code.indexOf('_useTrackedAtomValue(countAtom'),
    )
    expect(result?.map?.sources).toContain('Counter.tsx')
  })

  it('leaves unsupported custom and namespace hooks unchanged with diagnostics', () => {
    const result = transform(fixture('unsupported'), '/project/src/hooks.tsx')
    const metadata = (result?.metadata as Record<string, unknown> | undefined)
      ?.jotaiVisualizer as JotaiVisualizerMetadata

    expect(metadata.transformedCalls).toBe(0)
    expect(metadata.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'unsupported-namespace-import',
      'unsupported-custom-hook',
    ])
    expect(result?.code).toContain('Jotai.useAtom(countAtom)')
    expect(result?.code).toContain('useAtomValue(countAtom)')
  })

  it('preserves the original options argument as the third tracked argument', () => {
    const result = transform(
      `
        import { useAtom } from 'jotai/react'
        export function Counter() {
          return useAtom(countAtom, options)
        }
      `,
      '/project/src/Counter.tsx',
    )

    expect(result?.code).toMatch(
      /_useTrackedAtom\(countAtom, \{[\s\S]*?\}, options\)/,
    )
  })

  it('diagnoses spread arguments instead of changing their call semantics', () => {
    const result = transform(
      `
        import { useAtom } from 'jotai'
        export function Counter() {
          return useAtom(...args)
        }
      `,
      '/project/src/Counter.tsx',
    )
    const metadata = (result?.metadata as Record<string, unknown> | undefined)
      ?.jotaiVisualizer as JotaiVisualizerMetadata

    expect(metadata.transformedCalls).toBe(0)
    expect(metadata.diagnostics[0]?.code).toBe('unsupported-arguments')
    expect(result?.code).toContain('useAtom(...args)')
  })
})
