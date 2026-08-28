#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { runCli } from "./cli.js";

void runCli(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
}).then((exitCode) => {
  process.exitCode = exitCode;
});
