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