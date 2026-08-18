import type { Plugin } from 'vite'

import { transformJotaiModule } from './transform.js'

export const VIRTUAL_RUNTIME_MODULE = 'virtual:jotai-visualizer/runtime'
export const RESOLVED_VIRTUAL_RUNTIME_MODULE =
  '\0virtual:jotai-visualizer/runtime'

export const virtualRuntimeModuleSource = `
export {
  registerVisualizerModule,
  useTrackedAtom,
  useTrackedAtomValue,
  useTrackedSetAtom,
} from '@jotai-visualizer/react/instrumentation'
`

export type JotaiVisualizerViteOptions = {
  exclude?: RegExp
  include?: RegExp
}

const matches = (pattern: RegExp, value: string) => {
  pattern.lastIndex = 0
  return pattern.test(value)
}

export const shouldInstrumentFile = (
  id: string,
  root: string,
  options: JotaiVisualizerViteOptions = {},
) => {
  const include = options.include ?? /\.[cm]?[jt]sx?$/
  const exclude = options.exclude ?? /(?:^|\/)node_modules\//
  const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/, '')
  const normalizedId = id.replaceAll('\\', '/')
  const isInsideRoot =
    !normalizedRoot ||
    normalizedId === normalizedRoot ||
    normalizedId.startsWith(`${normalizedRoot}/`)
  return (
    (options.include !== undefined || isInsideRoot) &&
    matches(include, normalizedId) &&
    !matches(exclude, normalizedId)
  )
}

export default function jotaiVisualizer(
  options: JotaiVisualizerViteOptions = {},
): Plugin {
  let root = ''

  return {
    name: 'jotai-visualizer',
    enforce: 'pre',
    apply: 'serve',
    configResolved(config) {
      root = config.root
    },
    resolveId(id) {
      return id === VIRTUAL_RUNTIME_MODULE
        ? RESOLVED_VIRTUAL_RUNTIME_MODULE
        : null
    },
    load(id) {
      return id === RESOLVED_VIRTUAL_RUNTIME_MODULE
        ? virtualRuntimeModuleSource
        : null
    },
    async transform(code, id) {
      const cleanId = id.split('?')[0] ?? id
      if (!shouldInstrumentFile(cleanId, root, options)) {
        return null
      }

      const result = await transformJotaiModule({
        code,
        id: cleanId,
        root,
        runtimeModule: VIRTUAL_RUNTIME_MODULE,
        hmr: true,
      })
      result.diagnostics.forEach((diagnostic) => {
        this.warn({
          id: cleanId,
          message: `[${diagnostic.code}] ${diagnostic.message}`,
          ...(diagnostic.line === undefined
            ? {}
            : {
                loc: {
                  line: diagnostic.line,
                  column: diagnostic.column ?? 0,
                },
              }),
        })
      })
      if (result.transformedCalls === 0) {
        return null
      }
      return { code: result.code, map: result.map }
    },
  }
}

export { transformJotaiModule } from './transform.js'
export type {
  TransformJotaiModuleOptions,
  TransformJotaiModuleResult,
} from './transform.js'
