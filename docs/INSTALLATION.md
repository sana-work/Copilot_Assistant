# Installation

Copilot Architect is shared as an internal TypeScript/Node.js repository. The normal setup path is clone, install, build, test, then run the CLI locally.

## Requirements

- **Node.js 20.11 or newer** — `npm run cli -- doctor` will report an error if the version is too old.
- **npm** — included with Node.js.
- **Git** — recommended; enables review diff, git checkpoints, and handoff safety notes.

Verify your environment:

```bash
node --version    # must be v20.11.0 or newer
npm --version
git --version
```

---

## Option 1 — Run from Source (Recommended)

```bash
git clone <internal-repo-url>
cd copilot-architect
scripts/setup.sh
```

On Windows PowerShell:

```powershell
.\scripts\setup.ps1
```

The setup script runs `npm install`, `npm run build`, `npm test`, and `npm run cli -- doctor` automatically.

Manual equivalent:

```bash
npm install
npm run build
npm test
npm run cli -- version
npm run cli -- doctor
npm run cli -- demo       # verify end-to-end
```

---

## Option 2 — npm Link (Global Command)

Use `npm link` when you want a global `copilot-architect` command from a local checkout:

```bash
npm install
npm run build
npm link --workspace @copilot-architect/cli
copilot-architect version
copilot-architect doctor
copilot-architect demo
```

When switching branches or pulling updates, rebuild before using the linked command:

```bash
npm run build
copilot-architect version
```

Remove the link:

```bash
npm unlink --global @copilot-architect/cli
```

---

## Option 3 — Local Package Tarball

Use the local package script when a teammate needs a single artifact instead of a full clone:

```bash
npm run package:local
```

This script builds all TypeScript packages, verifies `version` and `doctor`, and writes artifacts under `dist/release/`:

- `copilot-architect-<version>.tgz`
- `release-manifest.json`
- `README.md`

Install from the tarball on a teammate's machine:

```bash
npm install -g ./copilot-architect-0.1.1.tgz
copilot-architect version
copilot-architect doctor
```

---

## First Run After Installation

After any install option, verify the tool works end-to-end:

```bash
npm run cli -- doctor           # environment checks (Node.js version, packages)
npm run cli -- version          # confirm installed version
npm run cli -- demo             # end-to-end demo: analyze → index → search → diagnostics
```

Then initialize a target repo:

```bash
npm run cli -- init             # creates .copilot-architect/commands.json and policy.json
npm run cli -- analyze          # detect languages, frameworks, commands
npm run cli -- index            # build local searchable index
```

---

## Updating

After pulling a new version from the internal repo:

```bash
git pull
npm install          # install any new dependencies
npm run build        # recompile TypeScript
npm test             # verify nothing is broken
npm run cli -- version
npm run cli -- doctor
```

If using npm link, rebuild and the linked command updates automatically:

```bash
npm run build
copilot-architect version
```

See [UPGRADE_GUIDE.md](UPGRADE_GUIDE.md) for version-specific instructions.

---

## Verifying MCP Integration

After installation, test the MCP server:

```bash
npm run cli -- mcp config --path /path/to/target-repo   # writes .vscode/mcp.json
npm run cli -- mcp --path /path/to/target-repo          # starts stdio server (Ctrl+C to stop)
```

Then in VS Code: Command Palette → `MCP: List Servers` → start `copilotArchitect`.

---

## Supported Platforms

- macOS (tested)
- Linux (tested in CI)
- Windows (PowerShell setup script provided; `clip` clipboard, cross-platform path handling)
