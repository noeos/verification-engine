// SPDX-License-Identifier: Apache-2.0

import { copyFile, mkdir, open, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { assertProjectRoot, isPathInside, projectRoot, run, stableJson } from "./project.mjs";

const generatedTargets = [
  resolve(projectRoot, ".build"),
  resolve(projectRoot, "packages/engine/dist"),
  resolve(projectRoot, "packages/engine/temp"),
  resolve(projectRoot, "packages/cli/dist"),
];

await assertProjectRoot();
const buildLock = await acquireBuildLock();
try {
  await clean();

  if (process.argv.includes("--clean-only")) {
    process.exitCode = 0;
  } else {
    const compiler = resolve(projectRoot, "node_modules/typescript/bin/tsc");
    run(process.execPath, [resolve(projectRoot, "scripts/generate-contracts.mjs")]);
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
} finally {
  await buildLock.release();
}

async function clean() {
  for (const target of generatedTargets) {
    if (!isPathInside(projectRoot, target)) {
      throw new Error(`Unsafe build target: ${target}`);
    }
    await rm(target, { force: true, recursive: true });
  }
}

async function acquireBuildLock() {
  const lockPath = resolve(projectRoot, ".build.lock");
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${String(process.pid)}\n`, "utf8");
      await handle.close();
      return {
        async release() {
          await rm(lockPath, { force: true });
        },
      };
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      if (Date.now() >= deadline) {
        throw new Error("Timed out waiting for the shared build lock.", { cause: error });
      }
      await delay(100);
    }
  }
}

function isAlreadyExists(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
