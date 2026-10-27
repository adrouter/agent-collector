# AdRouter agent collector

Development candidate for AdRouter v4 specification 0.1. MIT licensed. This source is not an accepted pilot release. No native platform is currently qualified; see `contracts/capabilities.json` and `docs/acceptance.md`.

The TypeScript OpenClaw observer and Python Hermes observer select bounded metadata, pseudonymize correlation locally and hand sanitized events to a background SQLite queue. Collection requires explicit enrollment and a current private-metadata grant. Research is separate and off by default. No tool results or agent behavior are changed.

## Development

Use Node 24.22.1 (`nvm use`) and Python 3.12.2. Run `npm ci`, `npm run check`, install `hermes/requirements.lock` in an isolated Python environment, then `npm run test:python`.

`npm run package` derives the archives and checksums from source. `artifacts/` is ignored. Build accepted release artifacts only from exact reviewed clean commits. Do not publish npm or PyPI packages.

See [installation](docs/installation.md), [acceptance](docs/acceptance.md), and [remaining work](docs/remaining-work.md).
