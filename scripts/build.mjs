// SPDX-License-Identifier: Apache-2.0

import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { assertProjectRoot, projectRoot, run, stableJson } from "./project.mjs";

const generatedTargets = [
  resolve(projectRoot, ".build"),
  resolve(projectRoot, "packages/engine/dist"),
  resolve(projectRoot, "packages/engine/temp"),
  resolve(projectRoot, "packages/cli/dist"),
];

await assertProjectRoot();
await clean();

if (process.argv.includes("--clean-only")) {
  process.exitCode = 0;
} else {
  const compiler = resolve(projectRoot, "node_modules/typescript/bin/tsc");
  run(process.execPath, [compiler, "--project", "packages/engine/tsconfig.esm.json"]);
  run(process.execPath, [compiler, "--project", "packages/engine/tsconfig.cjs.json"]);
  run(process.execPath, [compiler, "--project", "packages/cli/tsconfig.json"]);

  await mkdir(resolve(projectRoot, "packages/engine/dist/cjs"), { recursive: true });
  await writeFile(
    resolve(projectRoot, "packages/engine/dist/cjs/package.json"),
    stableJson({ type: "commonjs" }),
    "utf8",
  );

  for (const workspace of ["engine", "cli"]) {
    await copyFile(
      resolve(projectRoot, "LICENSE"),
      resolve(projectRoot, `packages/${workspace}/LICENSE`),
    );
    await copyFile(
      resolve(projectRoot, "NOTICE"),
      resolve(projectRoot, `packages/${workspace}/NOTICE`),
    );
  }
}

async function clean() {
  for (const target of generatedTargets) {
    if (!target.startsWith(`${projectRoot}/`)) {
      throw new Error(`Unsafe build target: ${target}`);
    }
    await rm(target, { force: true, recursive: true });
  }
}
