# Privacy and data handling

Jotai Visualizer runs inside the inspected application. Atom values may contain
credentials, personal data, tokens, health information, or proprietary business data.

## Defaults

- Value preview is disabled unless the application enables it.
- No telemetry or remote transport is included.
- No graph snapshot is persisted by the package.
- Private Jotai atoms are collected for local debugging but hidden in the UI by default.
- Production example builds remove the Visualizer and instrumentation.

## Recommended configuration

```ts
const runtime = createRuntimeGraph({
  valuePreview: {
    enabled: true,
    maxLength: 120,
    redact: (_value, { atomLabel }) =>
      /password|secret|token|session|cookie/i.test(atomLabel),
  },
})
```

Redaction callback errors fail closed and display `[Redacted]`.

## Operator responsibilities

- Do not enable value preview in shared or production environments without review.
- Do not paste snapshots into public issues without removing sensitive values.
- Treat screenshots and exported browser logs as potentially sensitive.
- Keep the dev root behind `import.meta.env.DEV` and dynamic import it so UI CSS and
  runtime code are tree-shaken from production.

## Future remote transports

The 0.1 release does not include browser-extension or remote monitoring transports.
Any future transport must define authentication, redaction, retention, and user consent
before sending graph data outside the application process.
