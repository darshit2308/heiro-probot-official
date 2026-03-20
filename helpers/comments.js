// helpers/comments.js

// Adjust this import if you have a constants file, or just define it here:
const MAINTAINER_TEAM = '@hiero-ledger/maintainers'; 
export const MARKER = '';

const SIGNING_GUIDE = 'https://github.com/hiero-ledger/hiero-sdk-cpp/blob/main/docs/training/signing.md';
const MERGE_CONFLICTS_GUIDE = 'https://github.com/hiero-ledger/hiero-sdk-cpp/blob/main/docs/training/merge-conflicts.md';

function checkState(result) {
  if (result.error) return 'error';
  return result.passed ? 'pass' : 'fail';
}

function buildSection({ title, result, passMessage }) {
  const state = checkState(result);
  if (state === 'error') {
    return [
      `:warning: **${title}** -- This check encountered an internal error. ${MAINTAINER_TEAM} please review manually.`,
      '',
      `Error: ${result.errorMessage || 'Unknown error'}`,
    ].join('\n');
  }
  if (state === 'pass') {
    return `:white_check_mark: **${title}** -- ${passMessage}`;
  }
  return null;
}

function buildDCOSection(dco) {
  const common = buildSection({ title: 'DCO Sign-off', result: dco, passMessage: 'All commits have valid sign-offs. Nice work!' });
  if (common) return common;

  const failList = (dco.failures || []).map(f => `- \`${f.sha}\` ${f.message}`).join('\n');
  return [
    ':x: **DCO Sign-off** -- Uh oh! The following commits are missing the required DCO sign-off:',
    failList,
    '',
    `No worries, this is an easy fix! Add \`Signed-off-by: Your Name <email>\` to each commit (e.g. \`git commit -s\`). See the [Signing Guide](${SIGNING_GUIDE}).`,
  ].join('\n');
}

function buildGPGSection(gpg) {
  const common = buildSection({ title: 'GPG Signature', result: gpg, passMessage: 'All commits have verified GPG signatures. Locked and loaded!' });
  if (common) return common;

  const failList = (gpg.failures || []).map(f => `- \`${f.sha}\` ${f.message}`).join('\n');
  return [
    ':x: **GPG Signature** -- Heads up! The following commits don\'t have a verified GPG signature:',
    failList,
    '',
    `You'll need to sign your commits with GPG (e.g. \`git commit -S\`). See the [Signing Guide](${SIGNING_GUIDE}) for a step-by-step walkthrough.`,
  ].join('\n');
}

function buildMergeSection(merge) {
  const common = buildSection({ title: 'Merge Conflicts', result: merge, passMessage: 'No merge conflicts detected. Smooth sailing!' });
  if (common) return common;

  return [
    ':x: **Merge Conflicts** -- Oh no, this PR has merge conflicts with the base branch.',
    '',
    `Let's get this sorted! Update your branch (e.g. rebase or merge from base) and push. See the [Merge Conflicts Guide](${MERGE_CONFLICTS_GUIDE}) if you need a hand.`,
  ].join('\n');
}

function buildIssueLinkSection(issueLink) {
  const linked = (issueLink.issues || []).filter(i => i.isAssigned).map(i => `#${i.number}`).join(', ');
  const common = buildSection({ title: 'Issue Link', result: issueLink, passMessage: `Linked to ${linked} (assigned to you).` });
  if (common) return common;

  if (issueLink.reason === 'not_assigned') {
    const unassigned = (issueLink.issues || []).filter(i => !i.isAssigned).map(i => `#${i.number}`).join(', ');
    return [
      `:x: **Issue Link** -- Almost there! You are not assigned to the following linked issues: ${unassigned}.`,
      '',
      'Please ensure you are assigned to all linked issues before opening a PR. You can comment `/assign` on the issue to grab it!',
    ].join('\n');
  }
  return [
    ':x: **Issue Link** -- This PR is not linked to any issue.',
    '',
    'Please reference an issue using a closing keyword (e.g. `Fixes #123`) and ensure the issue is assigned to you. Every PR needs a home!',
  ].join('\n');
}

function buildChecksSection({ dco, gpg, merge, issueLink }) {
  return [
    '### PR Checks', '',
    buildDCOSection(dco), '', '---', '',
    buildGPGSection(gpg), '', '---', '',
    buildMergeSection(merge), '', '---', '',
    buildIssueLinkSection(issueLink),
  ].join('\n');
}

export function allChecksPassed({ dco, gpg, merge, issueLink }) {
  return (
    !dco.error && dco.passed &&
    !gpg.error && gpg.passed &&
    !merge.error && merge.passed &&
    !issueLink.error && issueLink.passed
  );
}

export function buildBotComment({ prAuthor, dco, gpg, merge, issueLink }) {
  const greeting = [
    `Hey @${prAuthor} :wave: thanks for the PR!`,
    "I'm your friendly **PR Helper Bot** :robot: and I'll be riding shotgun on this one, keeping track of your PR's status to help you get it approved and merged.",
    '',
    "This comment updates automatically as you push changes -- think of it as your PR's live scoreboard!",
    "Here's the latest:",
  ].join('\n');

  const checksSection = buildChecksSection({ dco, gpg, merge, issueLink });
  const passed = allChecksPassed({ dco, gpg, merge, issueLink });

  const footer = passed
    ? ':tada: *All checks passed! Your PR is ready for review. Great job!*'
    : ':hourglass_flowing_sand: *All checks must pass before this PR can be reviewed. You\'ve got this!*';

  const body = [MARKER, greeting, '', '---', '', checksSection, '', '---', '', footer].join('\n');
  return { marker: MARKER, body, allPassed: passed };
}