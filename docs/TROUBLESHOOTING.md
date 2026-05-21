# Troubleshooting

Start with the doctor command — it checks your Node.js version, package state, and setup:

```bash
npm run cli -- doctor
```

Then run the end-to-end demo to verify the full flow works:

```bash
npm run cli -- demo
```

---

## Node Version Is Too Old

The `doctor` command will report `node-version: error` if your Node.js version is below 20.11.

Run:

```bash
node --version    # must be v20.11.0 or newer
```

Install or upgrade Node.js from [https://nodejs.org/](https://nodejs.org/), then:

```bash
npm install
npm run build
npm run cli -- doctor
```

---

## CLI Dist Files Are Missing

If `npm run cli -- ...` cannot find `packages/cli/dist/index.js`:

```bash
npm run build
npm run cli -- version
```

After pulling updates, always rebuild:

```bash
git pull
npm install
npm run build
```

---

## npm Link Points at Old Code

Rebuild after pulling changes:

```bash
npm run build
copilot-architect version
```

If the global link is broken, recreate it:

```bash
npm unlink --global @copilot-architect/cli
npm link --workspace @copilot-architect/cli
copilot-architect doctor
```

---

## Local Package Script Fails

`npm run package:local` runs build, version, doctor, and `npm pack`. Fix the first failing command in the output, then rerun:

```bash
npm run build
npm run cli -- version
npm run cli -- doctor
npm run package:local
```

Generated artifacts appear under `dist/release/`.

---

## Validation Commands Are Blocked

Copilot Architect blocks dangerous commands by default. Review the policy and command config:

```bash
npm run cli -- policy show
npm run cli -- commands list
npm run cli -- validate
```

If a legitimate command is being blocked:

1. Check `.copilot-architect/policy.json` — add the command or pattern to `allowedPatterns`.
2. Check `.copilot-architect/commands.json` — commands listed here are always trusted.

Commands from `commands.json` bypass the executable allowlist (they still respect `blockedPatterns`).

---

## Command Not in Safe Executable Set

If a command like `bun test` or `cargo test` is rejected as unsupported, either:

1. Add it to `.copilot-architect/commands.json` (simplest approach):
   ```json
   { "test": [{ "name": "Bun tests", "command": "bun test" }] }
   ```
2. Or add the executable to `allowedPatterns` in `.copilot-architect/policy.json`.

**Executables already recognized as safe**: `npm`, `npx`, `pnpm`, `yarn`, `bun`, `deno`, `node`, `tsc`, `biome`, `vite`, `webpack`, `esbuild`, `turbo`, `nx`, `jest`, `vitest`, `mocha`, `playwright`, `cypress`, `pytest`, `python`, `python3`, `poetry`, `uv`, `ruff`, `mypy`, `flake8`, `black`, `mvn`, `gradle`, `ng`, `cargo`, `go`, `dotnet`.

---

## Runtime Artifacts Look Stale

Runtime artifacts live under `.copilot-architect/`. Refresh the repo intelligence:

```bash
npm run cli -- analyze
npm run cli -- index --rebuild
npm run cli -- diagnostics
```

Preview retention cleanup before deleting old artifacts:

```bash
npm run cli -- cleanup --dry-run
npm run cli -- cleanup --apply    # delete eligible artifacts
```

---

## Secret Appears in Logs

If a secret is showing up in validation logs or reports, add its pattern to `.copilot-architect/policy.json` under `secretRedactionPatterns`. Patterns are JavaScript regular expressions:

```json
"secretRedactionPatterns": [
  "MY_CUSTOM_SECRET=[^\\s]+"
]
```

Built-in redaction covers: `TOKEN`, `SECRET`, `PASSWORD`, `API_KEY`, `ACCESS_KEY`, `PRIVATE_KEY`, `CLIENT_SECRET`, AWS keys, GCP keys, Stripe keys, JWT tokens, database connection strings, npm tokens, Slack tokens, Bearer headers, and GitHub tokens. See [SECURITY_MODEL.md](SECURITY_MODEL.md) for the full list.

---

## MCP Server Fails to Start

```bash
npm run cli -- mcp config         # regenerate .vscode/mcp.json
npm run cli -- mcp                # test the stdio server directly
```

Confirm the generated `mcp.json` points to the correct `packages/cli/dist/index.js` path. If the path changed (e.g., after moving the checkout), regenerate the config:

```bash
npm run cli -- mcp config --force
```

---

## Plan or Index File Not Found

If `latest-plan.json` or `index.json` is missing:

```bash
npm run cli -- analyze            # regenerate repo-map
npm run cli -- index              # rebuild index
npm run cli -- plan "your task"   # generate a new plan
```

---

## Tests Fail After Update

```bash
npm install               # update dependencies
npm run build             # recompile
npm test                  # run all 147 tests
```

If a specific test file fails, check the test output for file path and line number, then review the relevant source file in `packages/`.

---

## Getting More Help

```bash
npm run cli -- --help              # list all commands
npm run cli -- <command> --help    # command-specific help
npm run cli -- doctor --json       # machine-readable environment check
npm run cli -- demo --json         # machine-readable demo result
```
