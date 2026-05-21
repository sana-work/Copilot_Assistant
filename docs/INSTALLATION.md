# Installation

Copilot Architect is shared as an internal TypeScript/Node.js repository. The normal setup path is clone, install, build, test, then run the CLI locally.

## Requirements

- Node.js 20.11 or newer.
- npm.
- Git, recommended for review and handoff checkpoint features.

## First-Time Setup

```bash
git clone <internal-repo-url>
cd copilot-architect
scripts/setup.sh
```

On Windows PowerShell:

```powershell
.\scripts\setup.ps1
```

Manual equivalent:

```bash
npm install
npm run build
npm test
npm run cli -- version
npm run cli -- doctor
```

## Local CLI Usage

Run commands through the root script:

```bash
npm run cli -- analyze
npm run cli -- index
npm run cli -- plan "Add invoice approval workflow"
npm run cli -- validate
npm run cli -- review
```

## npm Link

Use `npm link` when you want a global `copilot-architect` command from a local checkout:

```bash
npm install
npm run build
npm link --workspace @copilot-architect/cli
copilot-architect version
copilot-architect doctor
```

When switching branches or pulling updates, rebuild before using the linked command:

```bash
npm run build
copilot-architect version
```

Remove the link with:

```bash
npm unlink --global @copilot-architect/cli
```

## Local Package Tarball

Use the local package script when a teammate needs a single internal artifact:

```bash
npm run package:local
```

The script builds the TypeScript packages, verifies `version` and `doctor`, and writes artifacts under `dist/release/`:

- `copilot-architect-<version>.tgz`
- `release-manifest.json`
- `README.md`

The tarball is for internal sharing and extraction, not marketplace publishing.
