import type {
  NodePath,
  PluginObj,
  PluginPass,
} from '@babel/core'
import * as t from '@babel/types'

const hookNames = ['useAtom', 'useAtomValue', 'useSetAtom'] as const

type HookName = (typeof hookNames)[number]

const trackedHookNames: Record<HookName, string> = {
  useAtom: 'useTrackedAtom',
  useAtomValue: 'useTrackedAtomValue',
  useSetAtom: 'useTrackedSetAtom',
}

export type InstrumentationDiagnosticCode =
  | 'unsupported-arity'
  | 'unsupported-arguments'
  | 'unsupported-custom-hook'
  | 'unsupported-hook-reference'
  | 'unsupported-namespace-import'
  | 'unsupported-scope'

export type InstrumentationDiagnostic = {
  code: InstrumentationDiagnosticCode
  column?: number
  file: string
  line?: number
  message: string
}

export type JotaiVisualizerBabelOptions = {
  hmr?: boolean
  root?: string
  runtimeModule?: string
}

export type JotaiVisualizerMetadata = {
  diagnostics: InstrumentationDiagnostic[]
  transformedCalls: number
}

type InstrumentationState = PluginPass & {
  opts: JotaiVisualizerBabelOptions
}

type HookImport = {
  bindingName: string
  hookName: HookName
  path: NodePath<t.ImportSpecifier>
  transformedReferences: number
}

const normalizeSlashes = (value: string) => value.replaceAll('\\', '/')

const normalizeFile = (filename: string | undefined, root: string | undefined) => {
  const normalizedFilename = normalizeSlashes(filename ?? 'unknown.tsx')
  const normalizedRoot = root ? normalizeSlashes(root).replace(/\/$/, '') : ''
  return normalizedRoot && normalizedFilename.startsWith(`${normalizedRoot}/`)
    ? normalizedFilename.slice(normalizedRoot.length + 1)
    : normalizedFilename.replace(/^\/+/, '')
}

const fileStem = (file: string) => {
  const base = file.split('/').at(-1) ?? 'AnonymousComponent'
  return base.replace(/\.[^.]+$/, '') || 'AnonymousComponent'
}

const inferWrappedVariableName = (functionPath: NodePath<t.Function>) => {
  const parent = functionPath.parentPath
  if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
    return parent.node.id.name
  }
  if (
    parent?.isCallExpression() &&
    t.isIdentifier(parent.node.callee) &&
    ['memo', 'forwardRef'].includes(parent.node.callee.name)
  ) {
    const variable = parent.parentPath
    if (variable?.isVariableDeclarator() && t.isIdentifier(variable.node.id)) {
      return variable.node.id.name
    }
  }
  return undefined
}

const inferFunctionName = (
  functionPath: NodePath<t.Function>,
  file: string,
) => {
  if (
    (functionPath.isFunctionDeclaration() ||
      functionPath.isFunctionExpression()) &&
    functionPath.node.id
  ) {
    return functionPath.node.id.name
  }
  const variableName = inferWrappedVariableName(functionPath)
  if (variableName) {
    return variableName
  }
  if (functionPath.parentPath?.isExportDefaultDeclaration()) {
    return fileStem(file)
  }
  return undefined
}

const createMetadata = (
  componentName: string,
  file: string,
  functionPath: NodePath<t.Function>,
) => {
  const location = functionPath.node.loc?.start
  return t.objectExpression([
    t.objectProperty(
      t.identifier('id'),
      t.stringLiteral(`${file}#${componentName}`),
    ),
    t.objectProperty(t.identifier('name'), t.stringLiteral(componentName)),
    t.objectProperty(t.identifier('file'), t.stringLiteral(file)),
    ...(location
      ? [
          t.objectProperty(t.identifier('line'), t.numericLiteral(location.line)),
          t.objectProperty(
            t.identifier('column'),
            t.numericLiteral(location.column),
          ),
        ]
      : []),
  ])
}

const isSupportedComponentName = (name: string) => /^[A-Z]/.test(name)
const isCustomHookName = (name: string) => /^use[A-Z0-9]/.test(name)

export default function jotaiVisualizerBabelPlugin(): PluginObj<InstrumentationState> {
  return {
    name: 'jotai-visualizer-instrumentation',
    visitor: {
      Program: {
        exit(programPath, state) {
          const options = state.opts
          const runtimeModule =
            options.runtimeModule ?? 'virtual:jotai-visualizer/runtime'
          const file = normalizeFile(state.filename, options.root)
          const diagnostics: InstrumentationDiagnostic[] = []
          const imports: HookImport[] = []
          const trackedIdentifiers = new Map<HookName, t.Identifier>()
          let transformedCalls = 0

          const addDiagnostic = (
            code: InstrumentationDiagnosticCode,
            message: string,
            path: NodePath,
          ) => {
            diagnostics.push({
              code,
              message,
              file,
              ...(path.node.loc
                ? {
                    line: path.node.loc.start.line,
                    column: path.node.loc.start.column,
                  }
                : {}),
            })
          }

          programPath.get('body').forEach((bodyPath) => {
            if (
              !bodyPath.isImportDeclaration() ||
              !['jotai', 'jotai/react'].includes(bodyPath.node.source.value)
            ) {
              return
            }
            bodyPath.get('specifiers').forEach((specifierPath) => {
              if (specifierPath.isImportNamespaceSpecifier()) {
                const binding = programPath.scope.getBinding(
                  specifierPath.node.local.name,
                )
                binding?.referencePaths.forEach((referencePath) => {
                  const memberPath = referencePath.parentPath
                  if (
                    memberPath?.isMemberExpression() &&
                    !memberPath.node.computed &&
                    t.isIdentifier(memberPath.node.property) &&
                    hookNames.includes(memberPath.node.property.name as HookName)
                  ) {
                    addDiagnostic(
                      'unsupported-namespace-import',
                      'Namespace-imported Jotai hooks are not automatically instrumented',
                      memberPath,
                    )
                  }
                })
                return
              }
              if (!specifierPath.isImportSpecifier()) {
                return
              }
              const imported = specifierPath.node.imported
              const importedName = t.isIdentifier(imported)
                ? imported.name
                : imported.value
              if (!hookNames.includes(importedName as HookName)) {
                return
              }
              imports.push({
                bindingName: specifierPath.node.local.name,
                hookName: importedName as HookName,
                path: specifierPath,
                transformedReferences: 0,
              })
            })
          })

          imports.forEach((hookImport) => {
            const binding = programPath.scope.getBinding(hookImport.bindingName)
            if (!binding) {
              return
            }
            binding.referencePaths.forEach((referencePath) => {
              const callPath = referencePath.parentPath
              if (
                !callPath?.isCallExpression() ||
                callPath.get('callee').node !== referencePath.node
              ) {
                addDiagnostic(
                  'unsupported-hook-reference',
                  `${hookImport.hookName} must be called directly to be instrumented`,
                  referencePath,
                )
                return
              }
              if (callPath.node.arguments.length < 1 || callPath.node.arguments.length > 2) {
                addDiagnostic(
                  'unsupported-arity',
                  `${hookImport.hookName} must receive one or two arguments`,
                  callPath,
                )
                return
              }
              if (
                callPath.node.arguments.some(
                  (argument) =>
                    t.isSpreadElement(argument) ||
                    t.isArgumentPlaceholder(argument),
                )
              ) {
                addDiagnostic(
                  'unsupported-arguments',
                  `${hookImport.hookName} spread arguments cannot preserve the tracked hook signature`,
                  callPath,
                )
                return
              }
              const functionPath = callPath.findParent((path) =>
                path.isFunction(),
              ) as NodePath<t.Function> | null
              if (!functionPath) {
                addDiagnostic(
                  'unsupported-scope',
                  `${hookImport.hookName} is outside a named React component`,
                  callPath,
                )
                return
              }
              const componentName = inferFunctionName(functionPath, file)
              if (!componentName) {
                addDiagnostic(
                  'unsupported-scope',
                  `${hookImport.hookName} is inside an anonymous function`,
                  callPath,
                )
                return
              }
              if (isCustomHookName(componentName)) {
                addDiagnostic(
                  'unsupported-custom-hook',
                  `Custom hook ${componentName} requires manual tracking until component propagation is supported`,
                  callPath,
                )
                return
              }
              if (!isSupportedComponentName(componentName)) {
                addDiagnostic(
                  'unsupported-scope',
                  `${componentName} is not recognized as a React component`,
                  callPath,
                )
                return
              }

              let trackedIdentifier = trackedIdentifiers.get(hookImport.hookName)
              if (!trackedIdentifier) {
                trackedIdentifier = programPath.scope.generateUidIdentifier(
                  trackedHookNames[hookImport.hookName],
                )
                trackedIdentifiers.set(hookImport.hookName, trackedIdentifier)
              }
              const [atomArgument, ...remainingArguments] = callPath.node.arguments
              callPath.node.callee = t.cloneNode(trackedIdentifier)
              callPath.node.arguments = [
                atomArgument!,
                createMetadata(componentName, file, functionPath),
                ...remainingArguments,
              ]
              hookImport.transformedReferences += 1
              transformedCalls += 1
            })

            if (
              binding.referencePaths.length > 0 &&
              hookImport.transformedReferences === binding.referencePaths.length
            ) {
              const declaration = hookImport.path.parentPath
              hookImport.path.remove()
              if (
                declaration?.isImportDeclaration() &&
                declaration.node.specifiers.length === 0
              ) {
                declaration.remove()
              }
            }
          })

          if (transformedCalls > 0) {
            const specifiers = [...trackedIdentifiers.entries()].map(
              ([hookName, local]) =>
                t.importSpecifier(
                  t.cloneNode(local),
                  t.identifier(trackedHookNames[hookName]),
                ),
            )
            let registerIdentifier: t.Identifier | undefined
            if (options.hmr) {
              registerIdentifier = programPath.scope.generateUidIdentifier(
                'registerVisualizerModule',
              )
              specifiers.push(
                t.importSpecifier(
                  t.cloneNode(registerIdentifier),
                  t.identifier('registerVisualizerModule'),
                ),
              )
            }
            programPath.unshiftContainer(
              'body',
              t.importDeclaration(specifiers, t.stringLiteral(runtimeModule)),
            )

            if (registerIdentifier) {
              programPath.pushContainer(
                'body',
                t.expressionStatement(
                  t.callExpression(t.cloneNode(registerIdentifier), [
                    t.memberExpression(
                      t.metaProperty(
                        t.identifier('import'),
                        t.identifier('meta'),
                      ),
                      t.identifier('hot'),
                    ),
                    t.stringLiteral(file),
                  ]),
                ),
              )
            }
          }

          ;(state.file.metadata as Record<string, unknown>).jotaiVisualizer = {
            diagnostics,
            transformedCalls,
          } satisfies JotaiVisualizerMetadata
        },
      },
    },
  }
}
