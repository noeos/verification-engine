// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { assertProjectRoot, projectRoot, readJson, stableJson } from "./project.mjs";

await assertProjectRoot();

const expected = await readJson(resolve(projectRoot, "security/github-settings.json"));
const repository = expected.repository;
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
  throw new Error("GitHub settings contain an invalid repository identifier.");
}

const failures = [];
const repo = apiJson(`repos/${repository}`);
const actions = apiJson(`repos/${repository}/actions/permissions`);
const workflowPermissions = apiJson(`repos/${repository}/actions/permissions/workflow`);
const selectedActions = apiJson(`repos/${repository}/actions/permissions/selected-actions`);
const forkApproval = apiJson(
  `repos/${repository}/actions/permissions/fork-pr-contributor-approval`,
);
const rulesetList = apiJson(`repos/${repository}/rulesets`);
expect(
  "repository rulesets",
  rulesetList.map(({ name, target }) => ({ name, target })).sort(compareByName),
  [
    { name: "Protect main", target: "branch" },
    { name: "Protect release tags", target: "tag" },
  ].sort(compareByName),
);
const mainRuleset = readRuleset(rulesetList, "Protect main", "branch");
const tagRuleset = readRuleset(rulesetList, "Protect release tags", "tag");
const environment = apiJson(`repos/${repository}/environments/npm-staging`);
const deploymentPolicies = apiJson(
  `repos/${repository}/environments/npm-staging/deployment-branch-policies`,
);
const privateReporting = apiJson(`repos/${repository}/private-vulnerability-reporting`);
const organization = apiJson(`orgs/${expected.organization.login}`);

expect("repository visibility", repo.visibility, expected.visibility);
expect("default branch", repo.default_branch, expected.defaultBranch);
expect("delete branch on merge", repo.delete_branch_on_merge, expected.deleteBranchOnMerge);
expect("web commit sign-off", repo.web_commit_signoff_required, expected.webCommitSignoffRequired);
expect("repository description", repo.description, expected.repositoryMetadata.description);
expect("repository homepage", repo.homepage, expected.repositoryMetadata.homepage);
expect("repository archive state", repo.archived, expected.repositoryMetadata.archived);
expect("repository disabled state", repo.disabled, expected.repositoryMetadata.disabled);
expect("repository forking", repo.allow_forking, expected.repositoryMetadata.allowForking);
expect("repository topics", [...repo.topics].sort(), [...expected.topics].sort());

expect("issues", repo.has_issues, expected.features.issues);
expect("projects", repo.has_projects, expected.features.projects);
expect("downloads", repo.has_downloads, expected.features.downloads);
expect("wiki", repo.has_wiki, expected.features.wiki);
expect("pages", repo.has_pages, expected.features.pages);
expect("discussions", repo.has_discussions, expected.features.discussions);
expect("squash merge", repo.allow_squash_merge, expected.merge.allowSquashMerge);
expect("merge commits", repo.allow_merge_commit, expected.merge.allowMergeCommit);
expect("rebase merge", repo.allow_rebase_merge, expected.merge.allowRebaseMerge);
expect("auto merge", repo.allow_auto_merge, expected.merge.allowAutoMerge);
expect("update branch", repo.allow_update_branch, expected.merge.allowUpdateBranch);
expect("squash title", repo.squash_merge_commit_title, expected.merge.squashCommitTitle);
expect("squash message", repo.squash_merge_commit_message, expected.merge.squashCommitMessage);

expect("Actions enabled", actions.enabled, expected.actions.enabled);
expect("Actions selection", actions.allowed_actions, expected.actions.allowedActions);
expect("Action SHA pinning", actions.sha_pinning_required, expected.actions.shaPinningRequired);
expect(
  "GitHub-owned Actions",
  selectedActions.github_owned_allowed,
  expected.actions.allowedReferences.githubOwned,
);
expect(
  "verified Marketplace Actions",
  selectedActions.verified_allowed,
  expected.actions.allowedReferences.verified,
);
expect(
  "third-party Action allowlist",
  [...selectedActions.patterns_allowed].sort(),
  [...expected.actions.allowedReferences.patterns].sort(),
);
expect(
  "default workflow permissions",
  workflowPermissions.default_workflow_permissions,
  expected.actions.defaultWorkflowPermissions,
);
expect(
  "workflow PR approval permission",
  workflowPermissions.can_approve_pull_request_reviews,
  expected.actions.workflowsCanApprovePullRequests,
);
expect(
  "fork contributor approval",
  forkApproval.approval_policy,
  expected.actions.forkPullRequestApprovalPolicy,
);

auditMainRuleset(mainRuleset, expected.branchRules.main);
auditTagRuleset(tagRuleset, expected.tagRules["v*"]);
auditEnvironment(environment, deploymentPolicies, expected.environments["npm-staging"]);

expect(
  "secret scanning",
  repo.security_and_analysis.secret_scanning.status === "enabled",
  expected.features.secretScanning,
);
expect(
  "secret scanning push protection",
  repo.security_and_analysis.secret_scanning_push_protection.status === "enabled",
  expected.features.secretScanningPushProtection,
);
expect(
  "non-provider secret patterns",
  repo.security_and_analysis.secret_scanning_non_provider_patterns.status === "enabled",
  expected.features.secretScanningNonProviderPatterns,
);
expect(
  "secret validity checks",
  repo.security_and_analysis.secret_scanning_validity_checks.status === "enabled",
  expected.features.secretScanningValidityChecks,
);
expect(
  "Dependabot security updates",
  repo.security_and_analysis.dependabot_security_updates.status === "enabled",
  expected.features.automatedSecurityFixes,
);
expect(
  "Dependabot alerts",
  apiSucceeds(`repos/${repository}/vulnerability-alerts`),
  expected.features.dependabotAlerts,
);
expect(
  "private vulnerability reporting",
  privateReporting.enabled,
  expected.features.privateVulnerabilityReporting,
);

auditOrganization(organization, expected.organization);
auditLabels(repository, expected.labels);
auditPrivateSurface(repository, expected);

if (failures.length > 0) {
  throw new AggregateError(
    failures.map((failure) => new Error(failure)),
    "GitHub configuration audit failed",
  );
}

console.log(`GitHub configuration verified for ${repository}.`);

function apiJson(endpoint) {
  const output = runGh(["api", endpoint]);
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`GitHub returned invalid JSON for ${endpoint}`, { cause: error });
  }
}

function apiSucceeds(endpoint) {
  runGh(["api", endpoint]);
  return true;
}

function auditEnvironment(actual, policies, policy) {
  expect("environment name", actual.name, "npm-staging");
  expect("environment admin bypass", actual.can_admins_bypass, policy.canAdminsBypass);
  const reviewers = actual.protection_rules
    .filter(({ type }) => type === "required_reviewers")
    .flatMap(({ reviewers: entries }) => entries.map(({ reviewer }) => reviewer.login))
    .sort();
  expect("environment reviewers", reviewers, [...policy.requiredReviewers].sort());
  const reviewerRule = actual.protection_rules.find(({ type }) => type === "required_reviewers");
  expect("environment self-review", reviewerRule.prevent_self_review, policy.preventSelfReview);
  expect(
    "environment protected branches",
    actual.deployment_branch_policy.protected_branches,
    false,
  );
  expect(
    "environment custom policies",
    actual.deployment_branch_policy.custom_branch_policies,
    policy.selectedTagsOnly,
  );
  expect("environment deployment policy count", policies.total_count, 1);
  expect(
    "environment deployment tag",
    policies.branch_policies.map(({ name, type }) => ({ name, type })),
    [{ name: policy.deploymentTagPattern, type: "tag" }],
  );
}

function auditMainRuleset(actual, policy) {
  expect("main ruleset enforcement", actual.enforcement, policy.enforcement);
  expect("main ruleset target", actual.target, "branch");
  expect("main ruleset refs", actual.conditions.ref_name.include, ["refs/heads/main"]);
  expect("main ruleset exclusions", actual.conditions.ref_name.exclude, []);
  expect("main ruleset bypass", actual.bypass_actors, policy.bypassActors);
  expect("main ruleset user bypass", actual.current_user_can_bypass, "never");
  const rules = indexRules(actual.rules);
  expect("main deletion protection", rules.has("deletion"), !policy.allowDeletions);
  expect("main force-push protection", rules.has("non_fast_forward"), !policy.allowForcePushes);
  expect("main linear history", rules.has("required_linear_history"), policy.requireLinearHistory);
  expect("main signatures", rules.has("required_signatures"), policy.requireSignedCommits);
  expect("main pull request", rules.has("pull_request"), policy.requirePullRequest);
  const pullRequest = rules.get("pull_request").parameters;
  expect(
    "main approval count",
    pullRequest.required_approving_review_count,
    policy.requiredApprovingReviewCount,
  );
  expect(
    "main stale reviews",
    pullRequest.dismiss_stale_reviews_on_push,
    policy.dismissStaleReviews,
  );
  expect("main code owners", pullRequest.require_code_owner_review, policy.requireCodeOwnerReview);
  expect(
    "main last push approval",
    pullRequest.require_last_push_approval,
    policy.requireLastPushApproval,
  );
  expect(
    "main conversation resolution",
    pullRequest.required_review_thread_resolution,
    policy.requireConversationResolution,
  );
  expect(
    "main unattributed changes approval",
    pullRequest.require_extra_approval_for_unattributed_changes,
    policy.requireExtraApprovalForUnattributedChanges,
  );
  expect("main merge methods", pullRequest.allowed_merge_methods, policy.allowedMergeMethods);
  const statusChecks = rules.get("required_status_checks").parameters;
  expect(
    "main strict status checks",
    statusChecks.strict_required_status_checks_policy,
    policy.strictRequiredChecks,
  );
  expect(
    "main required checks",
    statusChecks.required_status_checks.map(({ context }) => context),
    policy.requiredChecks,
  );
}

function auditLabels(repositoryName, policies) {
  const labels = apiJson(`repos/${repositoryName}/labels?per_page=100`);
  for (const policy of policies) {
    const actual = labels.find(({ name }) => name === policy.name);
    if (actual === undefined) {
      failures.push(`required label is missing: ${policy.name}`);
      continue;
    }
    expect(`label ${policy.name} color`, actual.color, policy.color);
    expect(`label ${policy.name} description`, actual.description, policy.description);
  }
}

function auditOrganization(actual, policy) {
  expect("organization login", actual.login, policy.login);
  expect(
    "organization default permission",
    actual.default_repository_permission,
    policy.defaultRepositoryPermission,
  );
  expect(
    "organization repository creation",
    actual.members_can_create_repositories,
    policy.membersCanCreateRepositories,
  );
  expect(
    "organization repository deletion",
    actual.members_can_delete_repositories,
    policy.membersCanDeleteRepositories,
  );
  expect(
    "organization visibility changes",
    actual.members_can_change_repo_visibility,
    policy.membersCanChangeRepositoryVisibility,
  );
  expect(
    "organization outside invitations",
    actual.members_can_invite_outside_collaborators,
    policy.membersCanInviteOutsideCollaborators,
  );
  expect(
    "organization private forks",
    actual.members_can_fork_private_repositories,
    policy.membersCanForkPrivateRepositories,
  );
  expect(
    "organization deploy keys",
    actual.deploy_keys_enabled_for_repositories,
    policy.repositoryDeployKeysEnabled,
  );
  expect(
    "organization two-factor authentication",
    actual.two_factor_requirement_enabled,
    policy.twoFactorAuthenticationRequired,
  );
  expect(
    "organization web sign-off",
    actual.web_commit_signoff_required,
    policy.webCommitSignoffRequired,
  );
}

function auditPrivateSurface(repositoryName, policy) {
  const collaborators = apiJson(`repos/${repositoryName}/collaborators?affiliation=all`)
    .map(({ login, role_name: role }) => ({ login, role }))
    .sort((left, right) => left.login.localeCompare(right.login, "en"));
  expect("collaborators", collaborators, policy.collaborators);
  expect(
    "deploy keys",
    apiJson(`repos/${repositoryName}/keys`).length,
    policy.privateSurface.deployKeys,
  );
  expect(
    "webhooks",
    apiJson(`repos/${repositoryName}/hooks`).length,
    policy.privateSurface.webhooks,
  );
  expect(
    "repository teams",
    apiJson(`repos/${repositoryName}/teams`).length,
    policy.privateSurface.repositoryTeams,
  );
  expect(
    "pending invitations",
    apiJson(`repos/${repositoryName}/invitations`).length,
    policy.privateSurface.pendingInvitations,
  );
  expect(
    "Actions secrets",
    apiJson(`repos/${repositoryName}/actions/secrets`).total_count,
    policy.privateSurface.actionsSecrets,
  );
  expect(
    "Actions variables",
    apiJson(`repos/${repositoryName}/actions/variables`).total_count,
    policy.privateSurface.actionsVariables,
  );
  expect(
    "Dependabot secrets",
    apiJson(`repos/${repositoryName}/dependabot/secrets`).total_count,
    policy.privateSurface.dependabotSecrets,
  );
  expect(
    "environment secrets",
    apiJson(`repos/${repositoryName}/environments/npm-staging/secrets`).total_count,
    policy.privateSurface.environmentSecrets,
  );
  expect(
    "environment variables",
    apiJson(`repos/${repositoryName}/environments/npm-staging/variables`).total_count,
    policy.privateSurface.environmentVariables,
  );
  expect(
    "open secret scanning alerts",
    apiJson(`repos/${repositoryName}/secret-scanning/alerts?state=open&per_page=100`).length,
    policy.privateSurface.openSecretScanningAlerts,
  );
  expect(
    "open Dependabot alerts",
    apiJson(`repos/${repositoryName}/dependabot/alerts?state=open&per_page=100`).length,
    policy.privateSurface.openDependabotAlerts,
  );
  expect(
    "open code scanning alerts",
    apiJson(`repos/${repositoryName}/code-scanning/alerts?state=open&per_page=100`).length,
    policy.privateSurface.openCodeScanningAlerts,
  );
}

function auditTagRuleset(actual, policy) {
  expect("tag ruleset enforcement", actual.enforcement, policy.enforcement);
  expect("tag ruleset target", actual.target, "tag");
  expect("tag ruleset refs", actual.conditions.ref_name.include, ["refs/tags/v*"]);
  expect("tag ruleset exclusions", actual.conditions.ref_name.exclude, []);
  expect("tag ruleset bypass", actual.bypass_actors, policy.bypassActors);
  expect("tag ruleset user bypass", actual.current_user_can_bypass, "never");
  const rules = indexRules(actual.rules);
  expect("tag deletion protection", rules.has("deletion"), !policy.allowDeletions);
  expect("tag update protection", rules.has("update"), !policy.allowUpdates);
  expect(
    "tag non-fast-forward protection",
    rules.has("non_fast_forward"),
    !policy.allowNonFastForwardUpdates,
  );
  expect("tag signatures", rules.has("required_signatures"), policy.requireSignedTags);
}

function expect(label, actual, wanted) {
  if (stableJson(actual) !== stableJson(wanted)) {
    failures.push(`${label}: expected ${JSON.stringify(wanted)}, found ${JSON.stringify(actual)}`);
  }
}

function compareByName(left, right) {
  return left.name.localeCompare(right.name, "en");
}

function indexRules(rules) {
  return new Map(rules.map((rule) => [rule.type, rule]));
}

function readRuleset(rulesets, name, target) {
  const matches = rulesets.filter((ruleset) => ruleset.name === name && ruleset.target === target);
  if (matches.length !== 1) {
    throw new Error(`Expected one ${name} ruleset; found ${matches.length}.`);
  }
  return apiJson(`repos/${repository}/rulesets/${matches[0].id}`);
}

function runGh(arguments_) {
  try {
    return execFileSync("gh", arguments_, {
      encoding: "utf8",
      env: { ...process.env, GH_PROMPT_DISABLED: "1" },
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(`GitHub CLI request failed: gh ${arguments_.join(" ")}`, { cause: error });
  }
}
