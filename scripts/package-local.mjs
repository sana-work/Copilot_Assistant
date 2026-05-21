#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(rootDir, "dist", "release");
const packageJsonPath = path.join(rootDir, "package.json");
const npmCacheDir = path.join(tmpdir(), "copilot-architect-npm-cache");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const version = String(packageJson.version);
const packageName = String(packageJson.name);
const expectedTarballName = `${packageName}-${version}.tgz`;

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });
await mkdir(npmCacheDir, { recursive: true });

run(npmCommand, ["run", "build"]);
run(npmCommand, ["run", "cli", "--", "version"]);
run(npmCommand, ["run", "cli", "--", "doctor"]);

const packDir = await mkdtemp(path.join(tmpdir(), "copilot-architect-pack-"));

try {
  run(npmCommand, ["pack", "--pack-destination", packDir]);

  const sourceTarball = path.join(packDir, expectedTarballName);
  const targetTarball = path.join(releaseDir, expectedTarballName);
  await copyFile(sourceTarball, targetTarball);

  const manifest = {
    packageName,
    version,
    generatedAt: new Date().toISOString(),
    tarball: path.relative(rootDir, targetTarball),
    installDocs: "docs/INSTALLATION.md",
    teamSetupDocs: "docs/INTERNAL_TEAM_SETUP.md",
    troubleshootingDocs: "docs/TROUBLESHOOTING.md",
    upgradeDocs: "docs/UPGRADE_GUIDE.md",
    recommendedChecks: [
      "npm install",
      "npm run build",
      "npm test",
      "npm run cli -- version",
      "npm run cli -- doctor"
    ],
    notes: [
      "This is an internal sharing artifact, not a marketplace package.",
      "For day-to-day use, clone the repo or use npm link from a local checkout."
    ]
  };

  await writeFile(
    path.join(releaseDir, "release-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(releaseDir, "README.md"),
    [
      "# Copilot Architect Local Package",
      "",
      `Version: ${version}`,
      "",
      `Tarball: \`${expectedTarballName}\``,
      "",
      "This artifact is for internal team sharing. Prefer cloning the repository for normal development.",
      "",
      "Recommended receiver workflow:",
      "",
      "```bash",
      `tar -xzf ${expectedTarballName}`,
      "cd package",
      "npm install",
      "npm run build",
      "npm test",
      "npm run cli -- doctor",
      "```",
      "",
      "For active local development, see `docs/INSTALLATION.md` for `npm link` instructions.",
      ""
    ].join("\n"),
    "utf8"
  );

  console.log(`Created ${path.relative(rootDir, targetTarball)}`);
  console.log(
    `Created ${path.relative(rootDir, path.join(releaseDir, "release-manifest.json"))}`
  );
} finally {
  await rm(packDir, { recursive: true, force: true });
}

function run(command, args) {
  console.log(`$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir
    },
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
