// helpers/checks.js

export function hasDCOSignoff(message) {
  if (!message) return false;
  return /^Signed-off-by:\s+.+\s+<.+>/mi.test(message);
}

export function hasVerifiedGPGSignature(commit) {
  return commit?.commit?.verification?.verified === true;
}

export function isMergeCommit(commit) {
  return Array.isArray(commit?.parents) && commit.parents.length > 1;
}

export function checkDCO(commits, logger) {
  const failures = [];
  let skipped = 0;
  for (const c of commits) {
    if (isMergeCommit(c)) {
      skipped++;
      continue;
    }
    const message = c.commit?.message || '';
    const shortSha = (c.sha || '').slice(0, 7);
    const firstLine = message.split('\n')[0] || '(no message)';
    if (!hasDCOSignoff(message)) {
      failures.push({ sha: shortSha, message: firstLine });
    }
  }
  const checked = commits.length - skipped;
  logger.info(`DCO check: ${checked - failures.length}/${checked} passed (${skipped} merge commit(s) skipped)`);
  return { passed: failures.length === 0, failures };
}

export function checkGPG(commits, logger) {
  const failures = [];
  for (const c of commits) {
    const shortSha = (c.sha || '').slice(0, 7);
    const message = c.commit?.message || '';
    const firstLine = message.split('\n')[0] || '(no message)';
    if (!hasVerifiedGPGSignature(c)) {
      failures.push({ sha: shortSha, message: firstLine });
    }
  }
  logger.info(`GPG check: ${commits.length - failures.length}/${commits.length} passed`);
  return { passed: failures.length === 0, failures };
}

export async function checkMergeConflict(context, logger) {
  const maxAttempts = 5;
  const delayMs = 2000;
  let conflicts = false;
  let mergeableResolved = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data: pr } = await context.octokit.pulls.get(
      context.repo({ pull_number: context.payload.pull_request.number })
    );

    if (pr.mergeable !== null) {
      logger.info(`Merge conflict check: mergeable=${pr.mergeable}, state=${pr.mergeable_state}`);
      conflicts = !pr.mergeable;
      mergeableResolved = true;
      break;
    }

    if (attempt < maxAttempts) {
      logger.info(`Mergeable state not ready, waiting ${delayMs}ms (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  if (!mergeableResolved) {
    logger.info('Merge conflict check: mergeable never resolved after retries, assuming no conflicts');
  }
  return { passed: !conflicts };
}

export function parseIssueNumbers(body) {
  const numbers = new Set();
  const patterns = [
    /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi,
    /related\s+to\s+#(\d+)/gi,
  ];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(body)) !== null) {
      numbers.add(parseInt(match[1], 10));
    }
  }
  return numbers;
}

/**
 * Fetches each issue by number and checks whether the PR author is assigned.
 */
async function fetchAndCheckAssignees(context, fetchIssue, issueNumbers, prAuthor) {
  const results = [];
  for (const num of issueNumbers) {
    try {
      const issue = await fetchIssue(context, num);
      const isAssigned = (issue.assignees || []).some(
        (a) => a.login.toLowerCase() === prAuthor.toLowerCase()
      );
      results.push({ number: num, title: issue.title, isAssigned });
    } catch (err) {
      context.log.error(`Issue link check: could not fetch issue #${num}: ${err.message}`);
    }
  }
  return results;
}

/**
 * Checks whether the PR is linked to an issue and whether the PR author
 * is assigned to that issue.
 */
export async function checkIssueLink(context, { fetchIssue, fetchClosingIssueNumbers }) {
  const body = context.payload.pull_request?.body || '';
  const prAuthor = context.payload.pull_request?.user?.login;

  const issueNumbers = parseIssueNumbers(body);

  if (issueNumbers.size === 0) {
    const graphqlIssues = await fetchClosingIssueNumbers(context);
    graphqlIssues.forEach((n) => issueNumbers.add(n));
  }

  if (issueNumbers.size === 0) {
    context.log.info('Issue link check: no linked issues found');
    return { passed: false, reason: 'no_issue_linked', issues: [] };
  }

  const linkedIssues = await fetchAndCheckAssignees(context, fetchIssue, issueNumbers, prAuthor);

  if (linkedIssues.length === 0) {
    context.log.info('Issue link check: all linked issues returned errors');
    return { passed: false, reason: 'no_issue_linked', issues: [] };
  }

  const allAssigned = linkedIssues.every((i) => i.isAssigned);
  if (!allAssigned) {
    const missing = linkedIssues.filter((i) => !i.isAssigned).map((i) => `#${i.number}`).join(', ');
    context.log.info(`Issue link check: author ${prAuthor} not assigned to all linked issues (missing: ${missing})`);
    return { passed: false, reason: 'not_assigned', issues: linkedIssues };
  }

  context.log.info('Issue link check: passed (author assigned to all linked issues)');
  return { passed: true, reason: null, issues: linkedIssues };
}