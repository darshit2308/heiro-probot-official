// helpers/api.js

import { LABELS } from '../config/hiero-constants.js'; // Ensure you have this file
import { checkDCO, checkGPG, checkMergeConflict, checkIssueLink } from './checks.js';
import { buildBotComment, MARKER } from './comments.js';
// import { buildBotComment } from './comments.js'; // We will need to port this next

/**
 * Safely adds labels to an issue or PR using Probot context.
 */
export async function addLabels(context, labels) {
  if (!Array.isArray(labels)) return { success: false, error: 'labels must be an array' };
  try {
    await context.octokit.issues.addLabels(context.issue({ labels }));
    context.log.info(`Added labels: ${labels.join(', ')}`);
    return { success: true };
  } catch (error) {
    context.log.error(`Could not add labels: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Safely removes a label from an issue or PR.
 */
export async function removeLabel(context, labelName) {
  try {
    await context.octokit.issues.removeLabel(context.issue({ name: labelName }));
    context.log.info(`Removed label: ${labelName}`);
    return { success: true };
  } catch (error) {
    // Ignore 404s if the label wasn't there to begin with
    if (error.status !== 404) {
       context.log.error(`Could not remove label: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Safely adds assignees to an issue or PR.
 */
export async function addAssignees(context, assignees) {
  if (!Array.isArray(assignees)) return { success: false, error: 'assignees must be an array' };
  try {
    await context.octokit.issues.addAssignees(context.issue({ assignees }));
    context.log.info(`Added assignees: ${assignees.join(', ')}`);
    return { success: true };
  } catch (error) {
    context.log.error(`Could not add assignees: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Checks if a PR payload has a specific label.
 */
export function hasLabel(prPayload, labelName) {
  if (!prPayload?.labels?.length) return false;
  return prPayload.labels.some((label) => {
    const name = typeof label === 'string' ? label : label?.name;
    return typeof name === 'string' && name.toLowerCase() === labelName.toLowerCase();
  });
}

/**
 * Posts a new comment or updates an existing one identified by an HTML marker.
 */
export async function postOrUpdateComment(context, marker, body) {
  try {
    let existingCommentId = null;
    let page = 1;
    const perPage = 100;

    // Paginate to find existing bot comment
    while (!existingCommentId) {
      const { data: comments } = await context.octokit.issues.listComments(
        context.issue({ per_page: perPage, page })
      );

      for (const c of comments) {
        if (c.body && c.body.startsWith(marker)) {
          existingCommentId = c.id;
          break;
        }
      }
      if (comments.length < perPage) break;
      page++;
    }

    if (existingCommentId) {
      await context.octokit.issues.updateComment(
        context.repo({ comment_id: existingCommentId, body })
      );
      context.log.info('Updated existing bot comment');
    } else {
      await context.octokit.issues.createComment(context.issue({ body }));
      context.log.info('Created new bot comment');
    }
    return { success: true };
  } catch (error) {
    context.log.error(`Could not post/update comment: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches all commits for a pull request (paginated).
 */
export async function fetchPRCommits(context) {
  const commits = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await context.octokit.pulls.listCommits(
      context.repo({ pull_number: context.payload.pull_request.number, per_page: perPage, page })
    );
    commits.push(...response.data);
    if (response.data.length < perPage) break;
    page++;
  }
  context.log.info(`Fetched ${commits.length} commits for PR`);
  return commits;
}

/**
 * Swaps status labels based on check results.
 */
export async function swapStatusLabel(context, allPassed, force = false) {
  const pr = context.payload.pull_request;
  const labelToAdd = allPassed ? LABELS.NEEDS_REVIEW : LABELS.NEEDS_REVISION;
  const labelToRemove = allPassed ? LABELS.NEEDS_REVISION : LABELS.NEEDS_REVIEW;

  if (force) {
    if (hasLabel(pr, labelToRemove)) {
      await removeLabel(context, labelToRemove);
    }
    await addLabels(context, [labelToAdd]);
  } else {
    if (hasLabel(pr, labelToRemove)) {
      await removeLabel(context, labelToRemove);
      await addLabels(context, [labelToAdd]);
    }
  }
}


export async function fetchIssue(context, issueNumber) {
  const { data: issue } = await context.octokit.issues.get(
    context.repo({ issue_number: issueNumber })
  );
  return issue;
}

export async function fetchClosingIssueNumbers(context) {
  try {
    const query = `query($owner:String!,$repo:String!,$number:Int!){
      repository(owner:$owner,name:$repo){
        pullRequest(number:$number){
          closingIssuesReferences(first:10){
            nodes { number }
          }
        }
      }
    }`;
    const result = await context.octokit.graphql(query, {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      number: context.payload.pull_request.number,
    });
    const nodes = result.repository.pullRequest.closingIssuesReferences.nodes || [];
    return nodes.map(n => n.number);
  } catch (error) {
    context.log.error(`GraphQL closingIssuesReferences failed: ${error.message}`);
    return [];
  }
}

export async function runAllChecksAndComment(context) {
  let dco, gpg, merge, issueLink;
  let commits = [];

  try {
    commits = await fetchPRCommits(context);
  } catch (e) {
    context.log.error(`Failed to fetch PR commits: ${e.message}`);
    dco = { error: true, errorMessage: e.message };
    gpg = { error: true, errorMessage: e.message };
  }

  if (!dco) {
    try { dco = checkDCO(commits, context.log); }
    catch (e) { dco = { error: true, errorMessage: e.message }; }
  }

  if (!gpg) {
    try { gpg = checkGPG(commits, context.log); }
    catch (e) { gpg = { error: true, errorMessage: e.message }; }
  }

  try { merge = await checkMergeConflict(context, context.log); }
  catch (e) { merge = { error: true, errorMessage: e.message }; }

  try { issueLink = await checkIssueLink(context, { fetchIssue, fetchClosingIssueNumbers }); }
  catch (e) { issueLink = { error: true, errorMessage: e.message }; }

  const prAuthor = context.payload.pull_request.user.login;
  const { marker, body, allPassed } = buildBotComment({ prAuthor, dco, gpg, merge, issueLink });
  await postOrUpdateComment(context, marker, body);

  return { allPassed };
}