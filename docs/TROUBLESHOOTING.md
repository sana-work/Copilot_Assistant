# Troubleshooting

Start with the doctor command:

```bash
npm run cli -- doctor
```

## Node Version Is Too Old

Run:

```bash
node --version
```

Install Node.js 20.11 or newer, then rerun:

```bash
npm install
npm run build
npm run cli -- doctor
```

## CLI Dist Files Are Missing

If `npm run cli -- ...` cannot find `packages/cli/dist/index.js`, rebuild:

```bash
npm run build
npm run cli -- version
```

## npm Link Points At Old Code

Rebuild the repo after pulling changes:

```bash
npm run build
copilot-architect version
```

If the global link is broken, recreate it:

```bash
npm unlink --global @copilot-architect/cli
npm link --workspace @copilot-architect/cli
```

## Local Package Script Fails

`npm run package:local` runs build, version, doctor, and `npm pack`. Fix the first failing command in the output, then rerun:

```bash
npm run build
npm run cli -- version
npm run cli -- doctor
npm run package:local
```

The generated artifacts should appear under `dist/release/`.

## Validation Commands Are Blocked

Copilot Architect blocks dangerous commands by default. Review the policy and command config:

```bash
npm run cli -- policy show
npm run cli -- commands list
npm run cli -- validate
```

Use `.copilot-architect/policy.json` and `.copilot-architect/commands.json` for explicit internal team configuration.

## Runtime Artifacts Look Stale

Runtime artifacts are local and live under `.copilot-architect/`. Refresh the repo intelligence:

```bash
npm run cli -- analyze
npm run cli -- index --rebuild
npm run cli -- diagnostics
```

Preview retention cleanup before deleting old artifacts:

```bash
npm run cli -- cleanup --dry-run
```
