// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";

import { hasMatchingDcoSignoff } from "./dco-policy.mjs";
import { assertProjectRoot, projectRoot } from "./project.mjs";

await assertProjectRoot();

const base = process.env.NOEOS_BASE_SHA;
const head = process.env.NOEOS_HEAD_SHA;
if (base === undefined || head === undefined) {
  console.log("DCO range is not configured; pull-request-only check skipped.");
} else {
  const output = execFileSync(
    "git",
    ["log", "--format=%H%x1f%an%x1f%ae%x1f%B%x1e", `${base}..${head}`],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  );
  const unsigned = [];
  for (const record of output.split("\x1e")) {
    const trimmed = record.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const [sha, authorName, authorEmail, ...messageParts] = trimmed.split("\x1f");
    if (
      sha === undefined ||
      authorName === undefined ||
      authorEmail === undefined ||
      messageParts.length === 0
    ) {
      throw new Error("Git returned malformed commit metadata during the DCO check.");
    }
    const message = messageParts.join("\x1f");
    if (!hasMatchingDcoSignoff(message, authorName, authorEmail)) {
      unsigned.push(sha);
    }
  }
  if (unsigned.length > 0) {
    throw new Error(`Commits missing DCO sign-off: ${unsigned.join(", ")}`);
  }
  console.log("Every pull-request commit has DCO sign-off.");
}
