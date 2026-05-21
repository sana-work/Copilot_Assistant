# Upgrade Guide

Copilot Architect is shared as an internal repository and local tarball — not a marketplace package.

---

## Before Upgrading

Check your current version:

```bash
npm run cli -- version
npm run cli -- doctor
```

If you have runtime artifacts in a target repo, they live under `.copilot-architect/` and are forward-compatible. Commit only team-approved files you intend to share.

---

## Upgrading from Git

```bash
git pull
npm install          # install any new dependencies
npm run build        # recompile TypeScript
npm test             # verify all tests pass
npm run cli -- version
npm run cli -- doctor
npm run cli -- demo  # end-to-end verification
```

If you use a globally linked CLI, rebuild — the linked command updates automatically:

```bash
npm run build
copilot-architect version
copilot-architect doctor
```

---

## Upgrading from an Internal Tarball

```bash
tar -xzf copilot-architect-<version>.tgz
cd package
npm install
npm run build
npm test
npm run cli -- doctor
npm run cli -- demo
```

For active development, prefer a Git clone over editing an extracted tarball.

---

## Version 0.1.1 → Notes

### What Changed

- **Agent model**: All 7 agent templates now use `gpt-4o` (was `gpt-5.2`, which was fictional).
- **`demo` command added**: `npm run cli -- demo` — runs analyze → index → search → diagnostics and prints next steps.
- **`doctor` now validates Node.js version**: Versions below 20.11 report `status: "error"`.
- **Expanded secret redaction**: AWS, GCP, Stripe, JWT, PEM, database connection strings, npm tokens, Slack tokens now redacted automatically.
- **Extended safe executables**: `bun`, `deno`, `cargo`, `go`, `dotnet`, `tsc`, `biome`, `ruff`, `mypy`, `uv`, and more.

### After upgrading, refresh installed agents

If you have `.github/agents/*.agent.md` installed from a previous version, update them to get the `gpt-4o` model field:

```bash
npm run cli -- agents update
# backs up existing files to .bak before overwriting
```

Validate the updated agents:

```bash
npm run cli -- agents validate
```

---

## Compatibility Notes

- Runtime artifact schemas use `CURRENT_SCHEMA_VERSION` (`0.1.0`). Existing `.copilot-architect/` JSON files from 0.1.0 are compatible with 0.1.1.
- Generated artifacts stay under `.copilot-architect/`.
- The tool is TypeScript/Node.js-first. No C#/.NET engine or Visual Studio VSIX is required.
- `.copilot-architect/policy.json` from 0.1.0 will work in 0.1.1. You may want to regenerate it to pick up the new default `secretRedactionPatterns`:
  ```bash
  npm run cli -- init --overwrite
  # or manually edit .copilot-architect/policy.json
  ```

---

## Version and Changelog

Use internal semantic versions while the tool remains pre-1.0. For every internal release:

1. Update `CHANGELOG.md`.
2. Run `npm run cli -- version`.
3. Run `npm run cli -- doctor`.
4. Run `npm run cli -- demo`.
5. Run `npm run package:local`.
6. Share `dist/release/release-manifest.json` with the tarball.
