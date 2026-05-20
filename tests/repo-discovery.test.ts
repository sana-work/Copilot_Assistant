import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { RepoDiscoveryService } from "../packages/core/src/index.js";
import { runCli } from "../packages/cli/src/index.js";
import {
  ARTIFACT_DIRECTORY,
  type UniversalRepoMap,
  getArtifactFilePath
} from "../packages/shared/src/index.js";

describe("RepoDiscoveryService", () => {
  it("analyzes a React repo and writes repo-map.json", async () => {
    const repoRoot = await createRepo({
      ".git/HEAD": "ref: refs/heads/main",
      "package.json": JSON.stringify({
        scripts: { build: "vite build", test: "vitest run", lint: "eslint ." },
        dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
        devDependencies: { "@vitejs/plugin-react": "^4.0.0" }
      }),
      "package-lock.json": "{}",
      "tsconfig.json": "{}",
      "vite.config.ts": "import react from '@vitejs/plugin-react';",
      "src/main.tsx": "import React from 'react';",
      "src/App.tsx": "export function App() { return null; }",
      "src/components/InvoiceCard.tsx": "export function InvoiceCard() {}",
      "README.md": "# React app"
    });

    const result = await new RepoDiscoveryService().analyze({ startPath: repoRoot });
    const repo = result.repoMap.repos[0];

    expect(existsSync(getArtifactFilePath(repoRoot, "repoMap"))).toBe(true);
    expect(repo?.frameworks.map((framework) => framework.name)).toEqual(
      expect.arrayContaining(["React", "React DOM", "Vite React"])
    );
    expect(repo?.commands.build).toContainEqual(
      expect.objectContaining({ command: "npm", args: ["run", "build"] })
    );
    expect(repo?.documentationFiles).toEqual(["README.md"]);
    expect(repo?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "REPO_DISCOVERY"
    );
  });

  it("analyzes an Angular repo", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({
        scripts: { build: "ng build", test: "ng test", lint: "ng lint" },
        dependencies: { "@angular/core": "^17.0.0" },
        devDependencies: { "@angular/cli": "^17.0.0" }
      }),
      "angular.json": JSON.stringify({
        projects: {
          app: { projectType: "application", root: "", sourceRoot: "src" }
        }
      }),
      "src/app/app.component.ts": "export class AppComponent {}",
      "src/app/app.service.ts": "export class AppService {}",
      "src/app/app.component.spec.ts": "describe('app', () => {})"
    });

    const result = await new RepoDiscoveryService().analyze({ startPath: repoRoot });
    const repo = result.repoMap.repos[0];

    expect(repo?.frameworks.map((framework) => framework.name)).toEqual(
      expect.arrayContaining(["Angular", "Angular CLI"])
    );
    expect(repo?.featurePatterns.map((pattern) => pattern.id)).toEqual(
      expect.arrayContaining([
        "angular-components",
        "angular-services",
        "angular-specs"
      ])
    );
  });

  it("analyzes a Python repo", async () => {
    const repoRoot = await createRepo({
      "pyproject.toml": '[tool.poetry]\nname = "api"\nfastapi = "*"\npytest = "*"',
      "poetry.lock": 'name = "fastapi"\nname = "pytest"',
      "requirements.txt": "fastapi\npytest\n",
      "pytest.ini": "[pytest]",
      "app/main.py": "from fastapi import FastAPI\napp = FastAPI()",
      "tests/test_main.py": "import unittest\n\ndef test_health(): pass"
    });

    const result = await new RepoDiscoveryService().analyze({ startPath: repoRoot });
    const repo = result.repoMap.repos[0];

    expect(repo?.languages.map((language) => language.name)).toContain("Python");
    expect(repo?.frameworks.map((framework) => framework.name)).toEqual(
      expect.arrayContaining(["FastAPI", "pytest", "unittest"])
    );
    expect(repo?.commands.test).toEqual(
      expect.arrayContaining([expect.objectContaining({ command: "pytest" })])
    );
  });

  it("analyzes Java Maven and Gradle repos", async () => {
    const mavenRoot = await createRepo({
      "pom.xml":
        "<project><artifactId>spring-boot-starter-web</artifactId><artifactId>junit-jupiter</artifactId></project>",
      mvnw: "",
      "src/main/java/com/acme/Application.java": "SpringApplication.run();",
      "src/test/java/com/acme/ApplicationTests.java":
        "import org.junit.jupiter.api.Test;"
    });
    const gradleRoot = await createRepo({
      "build.gradle":
        "plugins { id 'org.springframework.boot' version '3.2.0' }\ndependencies { testImplementation 'org.junit.jupiter:junit-jupiter' }",
      "settings.gradle": "rootProject.name = 'demo'",
      gradlew: "",
      "src/main/java/com/acme/Application.java": "SpringApplication.run();",
      "src/test/java/com/acme/ApplicationTests.java":
        "import org.junit.jupiter.api.Test;"
    });

    const maven = await new RepoDiscoveryService().analyze({ startPath: mavenRoot });
    const gradle = await new RepoDiscoveryService().analyze({ startPath: gradleRoot });

    expect(
      maven.repoMap.repos[0]?.frameworks.map((framework) => framework.name)
    ).toEqual(expect.arrayContaining(["Maven", "Spring Boot", "JUnit"]));
    expect(
      gradle.repoMap.repos[0]?.frameworks.map((framework) => framework.name)
    ).toEqual(expect.arrayContaining(["Gradle", "Spring Boot", "JUnit"]));
  });

  it("analyzes a polyglot monorepo", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({
        workspaces: ["packages/*"],
        scripts: { test: "npm test --workspaces" }
      }),
      "packages/web/package.json": JSON.stringify({
        dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" }
      }),
      "packages/web/src/App.tsx": "export function App() { return null; }",
      "packages/api/pyproject.toml": "[tool.poetry]\nfastapi = '*'",
      "packages/api/app/main.py": "from fastapi import FastAPI",
      "docs/architecture.md": "# Architecture"
    });

    const result = await new RepoDiscoveryService().analyze({ startPath: repoRoot });
    const repo = result.repoMap.repos[0];

    expect(result.repoMap.summary.projectCount).toBeGreaterThanOrEqual(3);
    expect(repo?.architecturalPatterns).toEqual(
      expect.arrayContaining(["monorepo", "polyglot", "documented-repository"])
    );
    expect(repo?.languages.map((language) => language.name)).toEqual(
      expect.arrayContaining(["TypeScript", "Python"])
    );
    expect(repo?.documentationFiles).toEqual(["docs/architecture.md"]);
  });

  it("analyzes an unknown repo with generic fallback", async () => {
    const repoRoot = await createRepo({
      "README.md": "# Mystery",
      "src/main.custom": "include thing\nvalue = 1",
      "tests/main.spec.custom": "assert value"
    });

    const result = await new RepoDiscoveryService().analyze({ startPath: repoRoot });
    const repo = result.repoMap.repos[0];

    expect(repo?.architecturalPatterns).toContain("generic-text-indexing");
    expect(repo?.featurePatterns.map((pattern) => pattern.id)).toEqual(
      expect.arrayContaining(["generic-docs", "generic-tests", "generic-imports"])
    );
  });

  it("supports CLI analyze --json and --output", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({
        scripts: { build: "vite build" },
        dependencies: { react: "^18.2.0" }
      }),
      "src/App.jsx": "export function App() { return null; }"
    });
    const stdout: string[] = [];
    const stderr: string[] = [];

    const result = await runCli(
      ["analyze", repoRoot, "--json", "--output", "custom-map.json"],
      {
        stdout: (message) => stdout.push(message),
        stderr: (message) => stderr.push(message)
      }
    );

    const parsed = JSON.parse(stdout.join("\n")) as UniversalRepoMap;

    expect(result.exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(parsed.repos[0]?.frameworks.map((framework) => framework.name)).toContain(
      "React"
    );
    expect(existsSync(path.join(repoRoot, "custom-map.json"))).toBe(true);
    expect(existsSync(path.join(repoRoot, ARTIFACT_DIRECTORY, "repo-map.json"))).toBe(
      true
    );

    const artifact = JSON.parse(
      await readFile(path.join(repoRoot, "custom-map.json"), "utf8")
    ) as UniversalRepoMap;
    expect(artifact.schemaVersion).toBe("0.1.0");
  });
});

async function createRepo(files: Record<string, string>): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-architect-repo-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(repoRoot, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents, "utf8");
  }

  return repoRoot;
}
