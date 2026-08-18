# @jotai-visualizer/babel-plugin

Babel 7 plugin that transforms supported Jotai hooks into development-time
tracked hooks with component and source metadata.

```sh
npm install --save-dev @jotai-visualizer/babel-plugin @babel/core
```

```json
{
  "plugins": [
    [
      "@jotai-visualizer/babel-plugin",
      {
        "runtimeModule": "@jotai-visualizer/react",
        "root": "/absolute/project/root"
      }
    ]
  ]
}
```

Most Vite users should install `@jotai-visualizer/vite` instead.

- [Automatic instrumentation](https://github.com/5vermind/jotai-visualizer/blob/main/docs/M4_AUTOMATIC_INSTRUMENTATION.md)
- [MIT License](./LICENSE)
