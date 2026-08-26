// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";

import { assertProjectRoot, projectRoot, run, stableJson } from "./project.mjs";

await assertProjectRoot();
run(process.execPath, [resolve(projectRoot, "scripts/build.mjs")]);

const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "noeos-consumer-"));
try {
  run(npmCommand(), [
    "pack",
    "--silent",
    "--ignore-scripts",
    "--pack-destination",
    temporaryDirectory,
    "--workspaces",
  ]);
  const tarballs = (await readdir(temporaryDirectory))
    .filter((name) => name.endsWith(".tgz"))
    .sort()
    .map((filename) => resolve(temporaryDirectory, filename));
  if (tarballs.length !== 2) {
    throw new Error(`Expected two workspace tarballs, received ${tarballs.length}`);
  }

  await writeFile(
    resolve(temporaryDirectory, "package.json"),
    stableJson({ name: "noeos-clean-consumer", private: true, type: "module", version: "1.0.0" }),
    "utf8",
  );

  run(
    npmCommand(),
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", ...tarballs],
    { cwd: temporaryDirectory },
  );

  await writeFile(
    resolve(temporaryDirectory, "esm.mjs"),
    'import * as engine from "@noeos/verification-engine";\nimport * as cli from "@noeos/verification-engine-cli";\nif (Object.keys(engine).length !== 0 || Object.keys(cli).length !== 0) process.exit(1);\n',
    "utf8",
  );
  await writeFile(
    resolve(temporaryDirectory, "common.cjs"),
    'const engine = require("@noeos/verification-engine");\nif (Object.keys(engine).length !== 0) process.exit(1);\n',
    "utf8",
  );
  await writeFile(
    resolve(temporaryDirectory, "consumer.ts"),
    'import * as engine from "@noeos/verification-engine";\nvoid engine;\n',
    "utf8",
  );
  await writeFile(
    resolve(temporaryDirectory, "tsconfig.json"),
    stableJson({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        strict: true,
        target: "ES2022",
      },
      include: ["consumer.ts"],
    }),
    "utf8",
  );

  run(process.execPath, [resolve(temporaryDirectory, "esm.mjs")], { cwd: temporaryDirectory });
  run(process.execPath, [resolve(temporaryDirectory, "common.cjs")], { cwd: temporaryDirectory });
  run(
    process.execPath,
    [
      resolve(projectRoot, "node_modules/typescript/bin/tsc"),
      "--project",
      resolve(temporaryDirectory, "tsconfig.json"),
    ],
    {
      cwd: temporaryDirectory,
      env: {
        ...process.env,
        PATH: `${resolve(projectRoot, "node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`,
      },
    },
  );

  for (const tarball of tarballs) {
    const data = await readFile(tarball);
    if (data.length === 0) {
      throw new Error(`Empty tarball generated: ${tarball}`);
    }
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}

console.log("Clean ESM, CommonJS, CLI-module, and TypeScript consumers passed.");

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}
