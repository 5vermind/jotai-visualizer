export type ObjectIdRegistry = {
  get(value: object): string
  peek(value: object): string | undefined
  release(value: object): boolean
}

export const createObjectIdRegistry = (prefix: string): ObjectIdRegistry => {
  const ids = new WeakMap<object, string>()
  let nextId = 1

  return {
    get: (value) => {
      let id = ids.get(value)
      if (!id) {
        id = `${prefix}:${nextId++}`
        ids.set(value, id)
      }
      return id
    },
    peek: (value) => ids.get(value),
    release: (value) => ids.delete(value),
  }
}
