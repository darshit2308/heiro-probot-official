import {
    LABELS,
    MAX_OPEN_ASSIGNMENTS,
    SKILL_PREREQUISITES,
    buildWelcomeComment,
    buildAlreadyAssignedComment,
    buildNotReadyComment,
    buildNoSkillLevelComment,
    buildAssignmentLimitExceededComment,
    buildPrerequisiteNotMetComment,
} from '../config/hiero-constants.js';

export async function handleAssign(context) {
    const issue     = context.payload.issue;
    const requester = context.payload.comment.user.login;
    const owner     = context.payload.repository.owner.login;
    const repo      = context.payload.repository.name;

    const issueLabels = issue.labels.map(l => l.name);

    await context.octokit.reactions.createForIssueComment({
        owner,
        repo,
        comment_id: context.payload.comment.id,
        content:    '+1',
    });

    if (issue.assignees?.length > 0) {
        const msg = buildAlreadyAssignedComment(requester, issue.assignees[0].login);
        return context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: msg });
    }

    if (!issueLabels.includes(LABELS.READY_FOR_DEV)) {
        const msg = buildNotReadyComment(requester);
        return context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: msg });
    }

    const skillLevels    = [LABELS.GOOD_FIRST_ISSUE, LABELS.BEGINNER, LABELS.INTERMEDIATE, LABELS.ADVANCED];
    const issueSkillLevel = skillLevels.find(level => issueLabels.includes(level));

    if (!issueSkillLevel) {
        const msg = buildNoSkillLevelComment(requester);
        return context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: msg });
    }

    const openSearchQuery       = `repo:${owner}/${repo} is:issue is:open assignee:${requester} -label:"${LABELS.BLOCKED}"`;
    const openSearch            = await context.octokit.search.issuesAndPullRequests({ q: openSearchQuery });
    const currentOpenAssignments = openSearch.data.total_count;

    if (currentOpenAssignments >= MAX_OPEN_ASSIGNMENTS) {
        const msg = buildAssignmentLimitExceededComment(requester, currentOpenAssignments);
        return context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: msg });
    }

    const prereq = SKILL_PREREQUISITES[issueSkillLevel];

    if (prereq.requiredLabel && prereq.requiredCount > 0) {
        const closedSearchQuery = `repo:${owner}/${repo} is:issue is:closed assignee:${requester} label:"${prereq.requiredLabel}"`;
        const closedSearch      = await context.octokit.search.issuesAndPullRequests({ q: closedSearchQuery });
        const completedCount    = closedSearch.data.total_count;

        if (completedCount < prereq.requiredCount) {
            const msg = buildPrerequisiteNotMetComment(requester, issueSkillLevel, completedCount);
            return context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: msg });
        }
    }

    await context.octokit.issues.addAssignees({ owner, repo, issue_number: issue.number, assignees: [requester] });

    const welcomeMsg = buildWelcomeComment(requester, issueSkillLevel);
    await context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: welcomeMsg });

    try {
        await context.octokit.issues.removeLabel({ owner, repo, issue_number: issue.number, name: LABELS.READY_FOR_DEV });
    } catch {
        // label may have already been removed — safe to ignore
    }

    await context.octokit.issues.addLabels({ owner, repo, issue_number: issue.number, labels: [LABELS.IN_PROGRESS] });
}