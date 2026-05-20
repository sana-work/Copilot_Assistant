# Release Plan

## Distribution

Copilot Architect is distributed as an internal TypeScript/Node.js repository. The intended workflow is:

```bash
git clone <repo>
cd copilot-architect
npm install
npm run build
npm test
npm run cli -- doctor
```

## Versioning

Use simple internal semantic versions while the project is pre-1.0. Release notes should summarize new commands, package changes, safety behavior, and known limitations.

## Packaging

The MVP does not require commercial packaging, marketplace publishing, a cloud backend, enterprise installer, Visual Studio VSIX, WPF, Blazor, or a .NET engine.

## Release Gates

- `npm install` succeeds.
- `npm run build` succeeds.
- `npm test` succeeds.
- `npm run cli -- doctor` succeeds.
- Documentation reflects current command behavior.
- Safety tests pass.
- Generated artifacts remain under `.copilot-architect/`.

## Future Channels

Later internal distribution may include npm package publishing, a VS Code extension shell, local web UI packaging, or prebuilt binaries. These are optional wrappers around the TypeScript core.
