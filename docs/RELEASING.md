# Releasing

## Prerequisites

- clean `main` branch
- Node.js and pnpm versions from the root manifest
- GitHub CLI authenticated to `5vermind/jotai-visualizer`
- for npm: an npm account with publish access to the `@jotai-visualizer` organization
- npm 2FA, granular token with bypass, or configured trusted publishing

npm organization scopes must exist before organization-scoped packages can be published.
See the [npm scoped package guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).

## Prepare

1. Update all public package versions together.
2. Update `CHANGELOG.md` and `docs/releases/<version>.md`.
3. Run:

```sh
pnpm install --frozen-lockfile
pnpm release:verify
```

This command runs the complete project checks, packs five tarballs, audits their contents,
and installs them into a fresh external Vite consumer.

## GitHub release

Create and push an annotated tag:

```sh
git tag -a v0.1.0 -m "Jotai Visualizer v0.1.0"
git push origin v0.1.0
```

`.github/workflows/release.yml` reruns release verification, creates the GitHub Release,
uploads five tarballs, and uploads `SHA256SUMS`.

## npm publish

The first scoped publish must be public. npm provenance also requires public repository
metadata and a supported hosted CI runner. See the
[npm provenance guide](https://docs.npmjs.com/generating-provenance-statements/).

After the npm organization and GitHub trusted publisher/environment are configured, run
the `Publish npm packages` workflow for the release tag. It publishes the already verified
tarballs in dependency order with `--access public --provenance`.

If using an npm token instead of trusted publishing, configure the `NPM_TOKEN` GitHub
environment secret and require maintainer approval on the `npm` environment.

## Post-release verification

```sh
gh release view v0.1.0
npm view @jotai-visualizer/core@0.1.0
npm view @jotai-visualizer/react@0.1.0
```

Verify npm signatures and provenance from a fresh install with `npm audit signatures`.
