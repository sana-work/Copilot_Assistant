import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../packages/shared/src/index.js";

describe("scanRepository", () => {
  it("skips the built-in ignore set", async () => {
    const root = await createRepo({
      "src/app.ts": "export const app = true;",
      "node_modules/pkg/index.js": "module.exports = {};",
      "dist/bundle.js": "console.log('built');",
      "__pycache__/cache.pyc": "binary"
    });

    const paths = (await scanRepository(root)).map((entry) => entry.relativePath);

    expect(paths).toContain("src/app.ts");
    expect(paths).not.toContain("node_modules/pkg/index.js");
    expect(paths).not.toContain("dist/bundle.js");
    expect(paths).not.toContain("__pycache__/cache.pyc");
  });

  it("honors a root .gitignore including globs, anchors, and negation", async () => {
    const root = await createRepo({
      ".gitignore": [
        "*.log",
        "secrets/",
        "/build-output",
        "generated/**",
        "!generated/keep.ts"
      ].join("\n"),
      "src/app.ts": "export const app = true;",
      "debug.log": "noise",
      "secrets/.env": "TOKEN=abc",
      "build-output/main.js": "built",
      "generated/skip.ts": "export const skip = true;",
      "generated/keep.ts": "export const keep = true;"
    });

    const paths = (await scanRepository(root)).map((entry) => entry.relativePath);

    expect(paths).toContain("src/app.ts");
    expect(paths).not.toContain("debug.log");
    expect(paths).not.toContain("secrets/.env");
    expect(paths).not.toContain("build-output/main.js");
    expect(paths).not.toContain("generated/skip.ts");
    // Negation re-includes a specific file that an earlier rule excluded.
    expect(paths).toContain("generated/keep.ts");
  });

  it("can be told to ignore .gitignore", async () => {
    const root = await createRepo({
      ".gitignore": "*.log",
      "debug.log": "noise"
    });

    const withGitignore = (await scanRepository(root)).map(
      (entry) => entry.relativePath
    );
    const withoutGitignore = (
      await scanRepository(root, { respectGitignore: false })
    ).map((entry) => entry.relativePath);

    expect(withGitignore).not.toContain("debug.log");
    expect(withoutGitignore).toContain("debug.log");
  });
});

async function createRepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "copilot-scan-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents, "utf8");
  }

  return root;
}
