import { describe, expect, it } from 'vitest'

import jotaiVisualizer, {
  RESOLVED_VIRTUAL_RUNTIME_MODULE,
  VIRTUAL_RUNTIME_MODULE,
  transformJotaiModule,
  shouldInstrumentFile,
  virtualRuntimeModuleSource,
} from '../src/index.js'

describe('Jotai Visualizer Vite plugin', () => {
  it('creates source-mapped HMR instrumentation through the virtual module', async () => {
    const result = await transformJotaiModule({
      code: `
        import { useAtomValue as readAtom } from 'jotai'
        export function Counter() {
          return readAtom(countAtom)
        }
      `,
      id: '/project/src/Counter.tsx',
      root: '/project',
    })

    expect(result.transformedCalls).toBe(1)
    expect(result.diagnostics).toEqual([])
    expect(result.code).toContain(`from "${VIRTUAL_RUNTIME_MODULE}"`)
    expect(result.code).toContain('registerVisualizerModule(import.meta.hot')
    expect(result.code).toContain('src/Counter.tsx#Counter')
    expect(result.map?.sources).toContain('/project/src/Counter.tsx')
  })

  it('is development-only and exposes a headless runtime virtual module', () => {
    const plugin = jotaiVisualizer()

    expect(plugin.name).toBe('jotai-visualizer')
    expect(plugin.enforce).toBe('pre')
    expect(plugin.apply).toBe('serve')
    expect(RESOLVED_VIRTUAL_RUNTIME_MODULE).toBe(
      `\0${VIRTUAL_RUNTIME_MODULE}`,
    )
    expect(virtualRuntimeModuleSource).toContain('useTrackedAtom')
    expect(virtualRuntimeModuleSource).toContain('registerVisualizerModule')
  })

  it('returns diagnostics without rewriting unsupported custom hooks', async () => {
    const result = await transformJotaiModule({
      code: `
        import { useAtomValue } from 'jotai'
        export function useCount() {
          return useAtomValue(countAtom)
        }
      `,
      id: '/project/src/useCount.ts',
      root: '/project',
    })

    expect(result.transformedCalls).toBe(0)
    expect(result.diagnostics[0]?.code).toBe('unsupported-custom-hook')
  })

  it('limits default transforms to application root files', () => {
    expect(
      shouldInstrumentFile('/repo/app/src/Counter.tsx', '/repo/app'),
    ).toBe(true)
    expect(
      shouldInstrumentFile('/repo/packages/react/src/hooks.ts', '/repo/app'),
    ).toBe(false)
    expect(
      shouldInstrumentFile('/repo/packages/feature/Counter.tsx', '/repo/app', {
        include: /packages\/feature/,
      }),
    ).toBe(true)
  })
})
