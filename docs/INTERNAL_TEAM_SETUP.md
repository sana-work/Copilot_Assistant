# Internal Team Setup

This guide is the short path for a new team member joining Copilot Architect development.

## New Team Member Setup

1. Clone the internal repository.
2. Run the setup script for your shell.
3. Confirm the CLI version and doctor output.
4. Run the sample MVP flow against a local repo.

```bash
git clone <internal-repo-url>
cd copilot-architect
scripts/setup.sh
npm run cli -- version
npm run cli -- doctor
```

Windows PowerShell:

```powershell
git clone <internal-repo-url>
cd copilot-architect
.\scripts\setup.ps1
npm run cli -- version
npm run cli -- doctor
```

## Daily Development Loop

```bash
npm run format
npm run lint
npm run build
npm test
```

Use the CLI through the root npm script while working inside this repo:

```bash
npm run cli -- analyze --path samples/react-app
npm run cli -- index --path samples/react-app
npm run cli -- search invoice --path samples/react-app
npm run cli -- plan "Add invoice approval workflow" --path samples/react-app
```

## Sharing With Another Local Repo

For active local development, link the CLI workspace:

```bash
npm run build
npm link --workspace @copilot-architect/cli
cd ../target-repo
copilot-architect doctor
copilot-architect analyze
```

For a handoff artifact, build a tarball:

```bash
cd copilot-architect
npm run package:local
```

Share the generated `dist/release/copilot-architect-<version>.tgz` inside the team.

## Release Checklist

- `npm install`
- `npm run format`
- `npm run lint`
- `npm run build`
- `npm test`
- `npm run cli -- version`
- `npm run cli -- doctor`
- `npm run package:local`
- Update `CHANGELOG.md`
