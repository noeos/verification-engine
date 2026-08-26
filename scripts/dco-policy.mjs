// SPDX-License-Identifier: Apache-2.0

export function hasMatchingDcoSignoff(message, authorName, authorEmail) {
  return message.split(/\r?\n/u).some((line) => {
    const match = /^Signed-off-by:\s*(.+?)\s*<([^<>\s]+)>\s*$/iu.exec(line);
    return (
      match !== null &&
      match[1] === authorName &&
      match[2].toLocaleLowerCase("en") === authorEmail.toLocaleLowerCase("en")
    );
  });
}
