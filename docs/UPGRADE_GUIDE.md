# Upgrade Guide

Copilot Architect is currently shared as an internal repository and local tarball, not a marketplace package.

## Before Pulling Changes

Check your current version:

```bash
npm run cli -- version
```

If you have generated runtime artifacts in a target repo, keep them under `.copilot-architect/` and commit only the team-approved files you intend to share.

## Upgrade From Git

```bash
git pull
npm install
npm run build
npm test
npm run cli -- version
npm run cli -- doctor
```

If you use a global linked CLI, rebuild after pulling:

```bash
npm run build
npm link --workspace @copilot-architect/cli
copilot-architect version
```

## Upgrade From an Internal Tarball

Extract the new tarball into a fresh directory and run the normal checks:

```bash
tar -xzf copilot-architect-<version>.tgz
cd package
npm install
npm run build
npm test
npm run cli -- doctor
```

For active development, prefer a Git clone over editing an extracted tarball.

## Version and Changelog

Use internal semantic versions while the tool remains pre-1.0. For every internal release:

- Update `CHANGELOG.md`.
- Run `npm run cli -- version`.
- Run `npm run cli -- doctor`.
- Run `npm run package:local`.
- Share `dist/release/release-manifest.json` with the tarball.

## Compatibility Notes

- Runtime artifact schemas use `CURRENT_SCHEMA_VERSION`.
- Generated artifacts stay under `.copilot-architect/`.
- The MVP is TypeScript/Node.js-first and does not require a C#/.NET engine or Visual Studio VSIX.
