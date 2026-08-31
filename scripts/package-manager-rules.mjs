// SPDX-License-Identifier: Apache-2.0

const allowedCommands = new Set(["ci", "pack", "publish", "run", "stage", "view"]);

export function parseVerifiedPackageManagerInvocation(arguments_) {
  if (
    arguments_.length < 4 ||
    arguments_[0] !== "--profile" ||
    arguments_[1].length === 0 ||
    arguments_[2] !== "--"
  ) {
    throw new Error(
      "Usage: node scripts/run-verified-package-manager.mjs --profile <profile-name> -- <command> [...arguments]",
    );
  }

  const packageManagerArguments = arguments_.slice(3);
  if (!allowedCommands.has(packageManagerArguments[0])) {
    throw new Error(
      `Unsupported package-manager command: ${packageManagerArguments[0] ?? "missing"}`,
    );
  }

  return { profileName: arguments_[1], packageManagerArguments };
}
