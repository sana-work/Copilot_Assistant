# Language Support

Copilot Architect supports all repositories through a universal adapter system. It provides deep support for common stacks and generic fallback support for unknown/custom repos through indexing, search, config detection, and custom commands.

## Deep Support Targets

- JavaScript
- TypeScript
- Angular
- React
- Node.js
- Python
- Java Maven
- Java Gradle

Deep support means adapters should detect language, framework, package manager, source folders, test folders, config files, build commands, test commands, lint commands, format commands, likely entry points, and common architectural patterns.

Phase 4 implements first-class detection for JavaScript/TypeScript, React, Angular, Python, Java Maven, and Java Gradle. The adapters are intentionally heuristic and local; they inspect manifests, config files, source file paths, and available file text.

## Generic Fallback Targets

- Go
- Rust
- C/C++
- PHP
- Ruby
- Shell
- SQL
- Unknown or custom languages

Fallback support does not claim perfect semantic understanding. It relies on file scanning, config detection, text indexing, search, custom commands, and human-readable architecture summaries.

## Monorepos And Multi-Repo Workspaces

The analyzer should treat each project root as a candidate repo unit while preserving workspace-level context. A mixed frontend/backend repo may produce multiple project maps under one workspace map.

## Package Managers

The MVP prioritizes npm, pip/venv/poetry where detectable, Maven, and Gradle. Additional package managers can be added through detector interfaces.
