// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";

import { assertProjectRoot, projectRoot, run, runNpm, stableJson } from "./project.mjs";

await assertProjectRoot();
run(process.execPath, [resolve(projectRoot, "scripts/build.mjs")]);

const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "noeos-consumer-"));
try {
  runNpm([
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

  runNpm(
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", ...tarballs],
    { cwd: temporaryDirectory },
  );

  await writeFile(
    resolve(temporaryDirectory, "esm.mjs"),
    'import { DIAGNOSTIC_CODES } from "@noeos/verification-engine";\nimport { SCHEMA_ASSETS } from "@noeos/verification-engine/schemas";\nimport { VECTOR_SET } from "@noeos/verification-engine/vectors";\nimport * as cli from "@noeos/verification-engine-cli";\nif (DIAGNOSTIC_CODES.length !== 64 || SCHEMA_ASSETS.length !== 5 || VECTOR_SET.version !== "1.0.0" || VECTOR_SET.files.length !== 4 || Object.keys(cli).length !== 0) process.exit(1);\n',
    "utf8",
  );
  await writeFile(
    resolve(temporaryDirectory, "common.cjs"),
    'const engine = require("@noeos/verification-engine");\nconst schemas = require("@noeos/verification-engine/schemas");\nconst vectors = require("@noeos/verification-engine/vectors");\nif (engine.DIAGNOSTIC_CODES.length !== 64 || schemas.SCHEMA_ASSETS.length !== 5 || vectors.VECTOR_SET.files.length !== 4) process.exit(1);\n',
    "utf8",
  );
  await writeFile(
    resolve(temporaryDirectory, "consumer.ts"),
    'import { DIAGNOSTIC_CODES, type DiagnosticCode } from "@noeos/verification-engine";\nimport { type SchemaId } from "@noeos/verification-engine/schemas";\nconst code: DiagnosticCode = DIAGNOSTIC_CODES[0].code;\nconst schema: SchemaId = "urn:noeos:verification-engine:record-evidence:1";\nvoid code;\nvoid schema;\n',
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
