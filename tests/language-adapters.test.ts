import { describe, expect, it } from "vitest";

import {
  AngularAdapter,
  JavaAdapter,
  JavaScriptTypeScriptAdapter,
  PythonAdapter,
  ReactAdapter,
  createDefaultAdapterRegistry
} from "../packages/adapters/src/index.js";
import type { AdapterContextInput } from "../packages/adapters/src/index.js";

describe("Phase 4 language and toolchain adapters", () => {
  it("detects JavaScript/TypeScript package managers, configs, and scripts", async () => {
    const registry = createDefaultAdapterRegistry();
    const result = await registry.analyze(jsTsSample());

    expect(
      registry.list().some((adapter) => adapter instanceof JavaScriptTypeScriptAdapter)
    ).toBe(true);
    expect(result.matchedAdapters).toContain("javascript-typescript");
    expect(result.merged.languages.map((language) => language.name)).toContain(
      "TypeScript"
    );
    expect(result.merged.packageManagers.map((manager) => manager.name)).toContain(
      "pnpm"
    );
    expect(result.merged.commands.build).toContainEqual(
      expect.objectContaining({ command: "pnpm", args: ["run", "build"] })
    );
    expect(result.merged.commands.validation).toContainEqual(
      expect.objectContaining({ name: "typecheck" })
    );
    expect(result.merged.configFiles).toEqual(
      expect.arrayContaining([
        "package.json",
        "pnpm-lock.yaml",
        "tsconfig.json",
        "vite.config.ts",
        "eslint.config.js",
        ".prettierrc"
      ])
    );
  });

  it("detects a React sample", async () => {
    const registry = createDefaultAdapterRegistry();
    const result = await registry.analyze(reactSample());

    expect(registry.list().some((adapter) => adapter instanceof ReactAdapter)).toBe(
      true
    );
    expect(result.matchedAdapters).toEqual(
      expect.arrayContaining(["javascript-typescript", "react"])
    );
    expect(result.merged.frameworks.map((framework) => framework.name)).toEqual(
      expect.arrayContaining(["React", "React DOM", "Vite React"])
    );
    expect(result.merged.featurePatterns.map((pattern) => pattern.id)).toEqual(
      expect.arrayContaining(["react-components", "react-hooks", "react-tests"])
    );
    expect(result.merged.entryPoints.map((entryPoint) => entryPoint.filePath)).toEqual(
      expect.arrayContaining(["src/main.tsx", "src/App.tsx"])
    );
  });

  it("detects an Angular sample", async () => {
    const registry = createDefaultAdapterRegistry();
    const result = await registry.analyze(angularSample());

    expect(registry.list().some((adapter) => adapter instanceof AngularAdapter)).toBe(
      true
    );
    expect(result.matchedAdapters).toEqual(
      expect.arrayContaining(["javascript-typescript", "angular"])
    );
    expect(result.merged.frameworks.map((framework) => framework.name)).toEqual(
      expect.arrayContaining(["Angular", "Angular CLI"])
    );
    expect(result.merged.commands.build).toContainEqual(
      expect.objectContaining({ command: "npm", args: ["run", "build"] })
    );
    expect(result.merged.commands.test).toContainEqual(
      expect.objectContaining({ command: "npm", args: ["test"] })
    );
    expect(result.merged.featurePatterns.map((pattern) => pattern.id)).toEqual(
      expect.arrayContaining([
        "angular-components",
        "angular-services",
        "angular-modules",
        "angular-guards",
        "angular-interceptors",
        "angular-specs"
      ])
    );
  });

  it("detects a Python sample", async () => {
    const registry = createDefaultAdapterRegistry();
    const result = await registry.analyze(pythonSample());

    expect(registry.list().some((adapter) => adapter instanceof PythonAdapter)).toBe(
      true
    );
    expect(result.matchedAdapters).toEqual(["python"]);
    expect(result.merged.languages.map((language) => language.name)).toContain(
      "Python"
    );
    expect(result.merged.frameworks.map((framework) => framework.name)).toEqual(
      expect.arrayContaining(["FastAPI", "pytest", "unittest"])
    );
    expect(result.merged.packageManagers.map((manager) => manager.name)).toEqual(
      expect.arrayContaining(["poetry", "pip"])
    );
    expect(result.merged.commands.test).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "pytest", args: [] }),
        expect.objectContaining({ command: "poetry", args: ["run", "pytest"] })
      ])
    );
  });

  it("detects a Java Maven sample", async () => {
    const registry = createDefaultAdapterRegistry();
    const result = await registry.analyze(javaMavenSample());

    expect(registry.list().some((adapter) => adapter instanceof JavaAdapter)).toBe(
      true
    );
    expect(result.matchedAdapters).toEqual(["java"]);
    expect(result.merged.frameworks.map((framework) => framework.name)).toEqual(
      expect.arrayContaining(["Maven", "Spring Boot", "JUnit"])
    );
    expect(result.merged.packageManagers.map((manager) => manager.name)).toEqual([
      "maven"
    ]);
    expect(result.merged.commands.test).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "./mvnw", args: ["test"] })
      ])
    );
    expect(result.merged.commands.build).toContainEqual(
      expect.objectContaining({ command: "./mvnw", args: ["package"] })
    );
  });

  it("detects a Java Gradle sample", async () => {
    const registry = createDefaultAdapterRegistry();
    const result = await registry.analyze(javaGradleSample());

    expect(result.matchedAdapters).toEqual(["java"]);
    expect(result.merged.frameworks.map((framework) => framework.name)).toEqual(
      expect.arrayContaining(["Gradle", "Spring Boot", "JUnit"])
    );
    expect(result.merged.packageManagers.map((manager) => manager.name)).toEqual([
      "gradle"
    ]);
    expect(result.merged.commands.test).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "./gradlew", args: ["test"] })
      ])
    );
    expect(result.merged.commands.build).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "./gradlew", args: ["build"] })
      ])
    );
  });
});

function jsTsSample(): AdapterContextInput {
  return {
    repoRoot: "/workspace/ts-app",
    files: [
      {
        path: "package.json",
        text: JSON.stringify({
          scripts: {
            build: "vite build",
            test: "vitest run",
            lint: "eslint .",
            format: "prettier --check .",
            typecheck: "tsc --noEmit",
            e2e: "playwright test"
          },
          dependencies: {
            fastify: "^4.0.0"
          }
        })
      },
      { path: "pnpm-lock.yaml" },
      { path: "tsconfig.json", text: "{}" },
      { path: "vite.config.ts", text: "export default {}" },
      { path: "eslint.config.js", text: "export default []" },
      { path: ".prettierrc", text: "{}" },
      { path: "src/index.ts", text: "import fastify from 'fastify';" },
      { path: "tests/index.test.ts" }
    ]
  };
}

function reactSample(): AdapterContextInput {
  return {
    repoRoot: "/workspace/react-app",
    files: [
      {
        path: "package.json",
        text: JSON.stringify({
          scripts: {
            build: "vite build",
            test: "vitest run",
            lint: "eslint ."
          },
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0"
          },
          devDependencies: {
            "@vitejs/plugin-react": "^4.0.0"
          }
        })
      },
      { path: "package-lock.json" },
      { path: "tsconfig.json", text: "{}" },
      { path: "vite.config.ts", text: "import react from '@vitejs/plugin-react';" },
      { path: "src/main.tsx", text: "import React from 'react';" },
      { path: "src/App.tsx", text: "export function App() { return null; }" },
      { path: "src/components/InvoiceCard.tsx" },
      { path: "src/hooks/useInvoices.ts" },
      { path: "src/App.test.tsx" }
    ]
  };
}

function angularSample(): AdapterContextInput {
  return {
    repoRoot: "/workspace/angular-app",
    files: [
      {
        path: "package.json",
        text: JSON.stringify({
          scripts: {
            build: "ng build",
            test: "ng test",
            lint: "ng lint"
          },
          dependencies: {
            "@angular/core": "^17.0.0",
            "@angular/common": "^17.0.0"
          },
          devDependencies: {
            "@angular/cli": "^17.0.0"
          }
        })
      },
      {
        path: "angular.json",
        text: JSON.stringify({
          projects: {
            app: {
              projectType: "application",
              root: "",
              sourceRoot: "src"
            },
            shared: {
              projectType: "library",
              root: "projects/shared",
              sourceRoot: "projects/shared/src"
            }
          }
        })
      },
      { path: "tsconfig.json", text: "{}" },
      { path: "src/app/app.component.ts" },
      { path: "src/app/invoice.service.ts" },
      { path: "src/app/app.module.ts" },
      { path: "src/app/auth.guard.ts" },
      { path: "src/app/api.interceptor.ts" },
      { path: "src/app/app.component.spec.ts" }
    ]
  };
}

function pythonSample(): AdapterContextInput {
  return {
    repoRoot: "/workspace/python-api",
    files: [
      {
        path: "pyproject.toml",
        text: '[tool.poetry]\nname = "api"\n[tool.poetry.dependencies]\nfastapi = "*"\npytest = "*"'
      },
      { path: "poetry.lock", text: 'name = "fastapi"\nname = "pytest"' },
      { path: "requirements.txt", text: "fastapi\npytest\n" },
      { path: "pytest.ini", text: "[pytest]\npythonpath = ." },
      {
        path: "app/main.py",
        text: "from fastapi import FastAPI\napp = FastAPI()"
      },
      {
        path: "tests/test_main.py",
        text: "import unittest\n\ndef test_health(): pass"
      }
    ]
  };
}

function javaMavenSample(): AdapterContextInput {
  return {
    repoRoot: "/workspace/java-maven",
    files: [
      {
        path: "pom.xml",
        text: [
          "<project>",
          "<artifactId>spring-boot-starter-web</artifactId>",
          "<artifactId>junit-jupiter</artifactId>",
          "</project>"
        ].join("")
      },
      { path: "mvnw" },
      {
        path: "src/main/java/com/acme/Application.java",
        text: "SpringApplication.run(Application.class, args);"
      },
      {
        path: "src/test/java/com/acme/ApplicationTests.java",
        text: "import org.junit.jupiter.api.Test;"
      }
    ]
  };
}

function javaGradleSample(): AdapterContextInput {
  return {
    repoRoot: "/workspace/java-gradle",
    files: [
      {
        path: "build.gradle",
        text: [
          "plugins { id 'org.springframework.boot' version '3.2.0' }",
          "dependencies { testImplementation 'org.junit.jupiter:junit-jupiter' }"
        ].join("\n")
      },
      { path: "settings.gradle", text: "rootProject.name = 'demo'" },
      { path: "gradlew" },
      {
        path: "src/main/java/com/acme/Application.java",
        text: "SpringApplication.run(Application.class, args);"
      },
      {
        path: "src/test/java/com/acme/ApplicationTests.java",
        text: "import org.junit.jupiter.api.Test;"
      }
    ]
  };
}
