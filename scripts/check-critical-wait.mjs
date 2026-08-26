// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";

import { assertProjectRoot, projectRoot } from "./project.mjs";
import {
  getFirstGitHubRunForHead,
  isCriticalPath,
  remainingCriticalWait,
} from "./critical-change-policy.mjs";

await assertProjectRoot();

const base = process.env.NOEOS_BASE_SHA;
const head = process.env.NOEOS_HEAD_SHA;
if (base === undefined || head === undefined) {
  console.log("Critical-path range is not configured; pull-request-only check skipped.");
} else {
  const changedFiles = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], {
    cwd: projectRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  const criticalFiles = changedFiles.filter((path) => isCriticalPath(path));

  if (criticalFiles.length === 0) {
    console.log("No critical paths changed; waiting-period check passed.");
  } else {
    const apiUrl = process.env.GITHUB_API_URL;
    const repository = process.env.GITHUB_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    if (apiUrl === undefined || repository === undefined || token === undefined) {
      throw new Error("GitHub identity is required to enforce the critical-change waiting period.");
    }

    const firstSeen = await getFirstGitHubRunForHead({ apiUrl, head, repository, token });
    const remainingMilliseconds = remainingCriticalWait(firstSeen);
    if (remainingMilliseconds > 0) {
      const remainingMinutes = Math.ceil(remainingMilliseconds / (60 * 1000));
      throw new Error(
        `Critical changes require 24 hours after GitHub first observes the final head. ${remainingMinutes} minute(s) remain. Changed paths: ${criticalFiles.join(", ")}`,
      );
    }
    console.log(`Critical-path waiting period passed for ${criticalFiles.length} changed files.`);
  }
}
