import { transformAsync, type BabelFileResult } from '@babel/core'

import jotaiVisualizerBabelPlugin, {
  type InstrumentationDiagnostic,
  type JotaiVisualizerMetadata,
} from '@jotai-visualizer/babel-plugin'

export type TransformJotaiModuleOptions = {
  code: string
  hmr?: boolean
  id: string
  root?: string
  runtimeModule?: string
}

export type TransformJotaiModuleResult = {
  code: string
  diagnostics: readonly InstrumentationDiagnostic[]
  map: BabelFileResult['map']
  transformedCalls: number
}

const parserPlugins = (id: string) => {
  const plugins: Array<'typescript' | 'jsx' | 'decorators-legacy'> = [
    'decorators-legacy',
  ]
  if (/\.[cm]?tsx?$/.test(id)) {
    plugins.push('typescript')
  }
  if (/\.[jt]sx$/.test(id)) {
    plugins.push('jsx')
  }
  return plugins
}

export const transformJotaiModule = async ({
  code,
  hmr = true,
  id,
  root,
  runtimeModule = 'virtual:jotai-visualizer/runtime',
}: TransformJotaiModuleOptions): Promise<TransformJotaiModuleResult> => {
  const cleanId = id.split('?')[0] ?? id
  const result = await transformAsync(code, {
    filename: cleanId,
    sourceFileName: cleanId,
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    sourceType: 'module',
    parserOpts: { plugins: parserPlugins(cleanId) },
    plugins: [
      [
        jotaiVisualizerBabelPlugin,
        { root, runtimeModule, hmr },
      ],
    ],
  })
  const metadata = (result?.metadata as Record<string, unknown> | undefined)
    ?.jotaiVisualizer as JotaiVisualizerMetadata | undefined

  return {
    code: result?.code ?? code,
    map: result?.map ?? null,
    diagnostics: metadata?.diagnostics ?? [],
    transformedCalls: metadata?.transformedCalls ?? 0,
  }
}
