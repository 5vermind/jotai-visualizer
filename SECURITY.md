# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| <0.1.0 | No |

## Reporting a vulnerability

Do not open a public issue for security vulnerabilities. Use
[GitHub private vulnerability reporting](https://github.com/5vermind/jotai-visualizer/security/advisories/new)
with a description, impact, affected version, and minimal reproduction.

We aim to acknowledge reports within 7 days. There is currently no paid bug
bounty program.

## Security boundaries

- Jotai Visualizer is a development tool and should be removed from production.
- Value preview is disabled by default and supports application-defined redaction.
- Runtime state is not transmitted over the network by this project.
- The project does not collect telemetry.
- npm provenance publishing is configured for registry releases.

See [Privacy and data handling](docs/PRIVACY.md) for runtime data guidance.
