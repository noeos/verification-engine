// SPDX-License-Identifier: Apache-2.0

export const minimumCriticalWaitMilliseconds = 24 * 60 * 60 * 1000;

const criticalPath =
  /^(?:\.github\/|package(?:-lock)?\.json$|packages\/[^/]+\/package\.json$|packages\/engine\/(?:schemas\/|src\/(?:framing|hashing|normalization)\/)|scripts\/|security\/|docs\/06-seguridad\/|docs\/09-legalidad\/|LICENSE$|NOTICE$|SECURITY\.md$)/u;

export function isCriticalPath(path) {
  return criticalPath.test(path);
}

export function remainingCriticalWait(firstSeen, now = Date.now()) {
  const firstSeenMilliseconds = Date.parse(firstSeen);
  if (!Number.isFinite(firstSeenMilliseconds)) {
    throw new Error(`Invalid GitHub workflow creation time: ${firstSeen}`);
  }
  return Math.max(0, firstSeenMilliseconds + minimumCriticalWaitMilliseconds - now);
}

export async function getFirstGitHubRunForHead({
  apiUrl,
  fetchImplementation = fetch,
  head,
  repository,
  token,
}) {
  const repositoryParts = repository.split("/");
  if (repositoryParts.length !== 2 || repositoryParts.some((part) => part.length === 0)) {
    throw new Error(`Invalid GitHub repository identifier: ${repository}`);
  }

  const [owner, name] = repositoryParts;
  const endpoint = new URL(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/actions/workflows/ci.yml/runs`,
    apiUrl,
  );
  endpoint.searchParams.set("event", "pull_request");
  endpoint.searchParams.set("head_sha", head);
  endpoint.searchParams.set("per_page", "100");

  const response = await fetchImplementation(endpoint, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub workflow-run query failed with HTTP ${response.status}.`);
  }

  const body = await response.json();
  if (body === null || typeof body !== "object" || !Array.isArray(body.workflow_runs)) {
    throw new Error("GitHub workflow-run query returned an unexpected response.");
  }

  const creationTimes = body.workflow_runs
    .filter(
      (run) =>
        run !== null &&
        typeof run === "object" &&
        run.event === "pull_request" &&
        run.head_sha === head &&
        typeof run.created_at === "string",
    )
    .map((run) => run.created_at)
    .filter((createdAt) => Number.isFinite(Date.parse(createdAt)))
    .sort((left, right) => Date.parse(left) - Date.parse(right));

  if (creationTimes.length === 0) {
    throw new Error(`No GitHub pull-request workflow run was found for head ${head}.`);
  }
  return creationTimes[0];
}
