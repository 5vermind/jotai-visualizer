# Changelog

All notable changes to Jotai Visualizer are documented here.

## 0.1.0 — 2026-08-18

### Added

- Runtime collection for mounted Jotai atoms and dynamic dependencies
- Component read/write/read-write consumer relationships
- Multiple Store, nested Provider, async atom, and atomFamily support
- Framework-independent atomic GraphStore and RuntimeGraph
- Embedded React Flow panel with filtering, details, highlighting, and Dagre layout
- Vite/Babel automatic instrumentation with source metadata and HMR cleanup
- Privacy-first value previews with redaction and special-value serialization
- Built-in headless Jotai inspector without UI-heavy devtools dependencies
- React 18/19 and Jotai 2.20 compatibility matrix
- 500-node performance budgets and browser benchmark fixture
- Development-only production tree-shaking verification

### Known limitations

- Custom hook consumers require manual tracking
- Jotai 3 and Vite 7/8 are not yet supported
- npm registry publishing requires the `@jotai-visualizer` organization setup
