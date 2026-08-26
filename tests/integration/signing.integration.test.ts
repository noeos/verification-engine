// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

void test("release tags accept only the reviewed SSH signing key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "noeos-signing-"));
  try {
    const signerKey = join(directory, "signer");
    const untrustedKey = join(directory, "untrusted");
    execute("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "reviewed", "-f", signerKey]);
    execute("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "untrusted", "-f", untrustedKey]);

    execute("git", ["init", "--quiet"], directory);
    execute("git", ["config", "user.name", "Daniel David"], directory);
    execute("git", ["config", "user.email", "ddcandales@gmail.com"], directory);
    execute("git", ["config", "gpg.format", "ssh"], directory);
    execute("git", ["config", "gpg.ssh.program", "ssh-keygen"], directory);
    execute("git", ["config", "user.signingkey", signerKey], directory);
    execute("git", ["commit", "--quiet", "--allow-empty", "--message", "test fixture"], directory);
    execute("git", ["tag", "--sign", "--message", "candidate", "v0.0.0-rc.0"], directory);

    const allowedSigners = join(directory, "allowed-signers");
    const signerPublicKey = (await readFile(`${signerKey}.pub`, "utf8")).trim();
    await writeFile(
      allowedSigners,
      `ddcandales@gmail.com namespaces="git" ${signerPublicKey}\n`,
      "utf8",
    );
    execute(
      "git",
      ["-c", `gpg.ssh.allowedSignersFile=${allowedSigners}`, "verify-tag", "v0.0.0-rc.0"],
      directory,
    );

    const untrustedPublicKey = (await readFile(`${untrustedKey}.pub`, "utf8")).trim();
    await writeFile(
      allowedSigners,
      `untrusted@example.com namespaces="git" ${untrustedPublicKey}\n`,
      "utf8",
    );
    assert.throws(
      () =>
        execute(
          "git",
          ["-c", `gpg.ssh.allowedSignersFile=${allowedSigners}`, "verify-tag", "v0.0.0-rc.0"],
          directory,
        ),
      /Command failed/u,
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

function execute(command: string, arguments_: string[], cwd?: string): string {
  return execFileSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
