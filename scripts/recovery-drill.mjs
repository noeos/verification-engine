// SPDX-License-Identifier: Apache-2.0

import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  assertProjectRoot,
  digest,
  listTarGzEntries,
  projectRoot,
  run,
  runNpm,
} from "./project.mjs";
import { isAllowedPackedPath } from "./policy-rules.mjs";

await assertProjectRoot();

const workspacePackages = ["@noeos/verification-engine", "@noeos/verification-engine-cli"];
const evidence = {
  version: 1,
  commit: process.env.GITHUB_SHA ?? "local",
  node: process.version,
  scenarios: [],
};
const root = await mkdtemp(resolve(tmpdir(), "noeos-recovery-drill-"));

try {
  run(process.execPath, [resolve(projectRoot, "scripts/build.mjs")]);
  run(process.execPath, [resolve(projectRoot, "scripts/check-policies.mjs")]);
  evidence.scenarios.push({ name: "reviewed-policy-rebuild", status: "passed" });

  const archives = [];
  for (const workspace of workspacePackages) {
    const destination = resolve(root, workspace.endsWith("-cli") ? "cli" : "engine");
    await mkdir(destination, { recursive: true });
    runNpm([
      "pack",
      "--silent",
      "--ignore-scripts",
      "--pack-destination",
      destination,
      "--workspace",
      workspace,
    ]);
    const files = (await readdir(destination)).filter((file) => file.endsWith(".tgz"));
    if (files.length !== 1) throw new Error(`${workspace} did not produce exactly one archive`);
    const archive = resolve(destination, files[0]);
    const bytes = await readFile(archive);
    const archiveEntries = listTarGzEntries(bytes).map((entry) => entry.replace(/^package\//u, ""));
    const forbidden = archiveEntries.filter((entry) => !isAllowedPackedPath(entry));
    if (forbidden.length > 0)
      throw new Error(`${workspace} packed forbidden paths: ${forbidden.join(", ")}`);
    archives.push({ workspace, archive, sha256: digest(bytes), entries: archiveEntries.length });
  }
  evidence.scenarios.push({
    name: "clean-rebuild-and-package",
    status: "passed",
    archives: archives.map(({ workspace, sha256, entries }) => ({ workspace, sha256, entries })),
  });

  const consumer = resolve(root, "consumer");
  await mkdir(consumer, { recursive: true });
  runNpm([
    "install",
    "--prefix",
    consumer,
    "--no-save",
    "--package-lock=false",
    "--ignore-scripts",
    ...archives.map(({ archive }) => archive),
  ]);
  evidence.scenarios.push({ name: "clean-consumer-install", status: "passed" });

  const tamperedPath = resolve(root, "tampered.tgz");
  await copyFile(archives[0].archive, tamperedPath);
  const tampered = await readFile(tamperedPath);
  tampered[tampered.length - 1] ^= 1;
  await writeFile(tamperedPath, tampered);
  const originalDigest = archives[0].sha256;
  const tamperedDigest = createHash("sha256").update(tampered).digest("hex");
  if (tamperedDigest === originalDigest)
    throw new Error("tamper drill did not change the archive digest");
  evidence.scenarios.push({
    name: "archive-tamper-detection",
    status: "passed",
    originalSha256: originalDigest,
    tamperedSha256: tamperedDigest,
  });

  run(process.execPath, [resolve(projectRoot, "scripts/check-engine-vectors.mjs")]);
  run(process.execPath, [resolve(projectRoot, "scripts/check-mutation.mjs")]);
  evidence.scenarios.push({ name: "protocol-and-mutation-recovery-check", status: "passed" });
} finally {
  await rm(root, { force: true, recursive: true });
}

process.stdout.write(`${JSON.stringify(evidence)}\n`);
