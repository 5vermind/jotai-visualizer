export type ValuePreviewContext = {
  atomLabel: string
  nodeId: string
  storeId: string
}

export type ValuePreviewPolicy = {
  enabled?: boolean
  maxLength?: number
  redact?: (value: unknown, context: ValuePreviewContext) => boolean
  redactedText?: string
}

const serializeValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined' ||
    typeof value === 'bigint'
  ) {
    return String(value)
  }
  if (value instanceof Promise) {
    return '[Promise]'
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`
  }

  try {
    const seen = new WeakSet<object>()
    const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => {
      if (typeof nestedValue === 'bigint') {
        return `${nestedValue}n`
      }
      if (typeof nestedValue === 'object' && nestedValue !== null) {
        if (seen.has(nestedValue)) {
          return '[Circular]'
        }
        seen.add(nestedValue)
      }
      return nestedValue
    })
    return serialized ?? Object.prototype.toString.call(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

export const createValuePreview = (
  value: unknown,
  context: ValuePreviewContext,
  policy: ValuePreviewPolicy = {},
): string | undefined => {
  if (!policy.enabled) {
    return undefined
  }

  try {
    if (policy.redact?.(value, context)) {
      return policy.redactedText ?? '[Redacted]'
    }
  } catch {
    return policy.redactedText ?? '[Redacted]'
  }

  const serialized = serializeValue(value)
  const maxLength =
    policy.maxLength !== undefined &&
    Number.isFinite(policy.maxLength) &&
    policy.maxLength >= 4
      ? Math.floor(policy.maxLength)
      : 120
  return serialized.length > maxLength
    ? `${serialized.slice(0, maxLength - 3)}...`
    : serialized
}
