// commands/assign.js

import { 
    LABELS, 
    MAX_OPEN_ASSIGNMENTS, 
    SKILL_PREREQUISITES,
    buildWelcomeComment,
    buildAlreadyAssignedComment,
    buildNotReadyComment,
    buildNoSkillLevelComment,
    buildAssignmentLimitExceededComment,
    buildPrerequisiteNotMetComment
} from '../config/hiero-constants.js';

export async function handleAssign(context) {
    const issue = context.payload.issue;
    const requester = context.payload.comment.user.login;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    const issueLabels = issue.labels.map(l => l.name);

    // GATE 1: Acknowledge the comment with a +1 reaction
    await context.octokit.reactions.createForIssueComment({
        owner, repo,
        comment_id: context.payload.comment.id,
        content: '+1'
    });

    // GATE 2: Is it already assigned?
    if (issue.assignees && issue.assignees.length > 0) {
        const currentAssignee = issue.assignees[0].login;
        const msg = buildAlreadyAssignedComment(requester, currentAssignee);
        return await context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: msg });
    }

    // GATE 3: Is it Ready for Dev?
    if (!issueLabels.includes(LABELS.READY_FOR_DEV)) {
        const msg = buildNotReadyComment(requester);
        return await context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: msg });
    }

    // GATE 4: Determine the Skill Level
    const skillLevels = [LABELS.GOOD_FIRST_ISSUE, LABELS.BEGINNER, LABELS.INTERMEDIATE, LABELS.ADVANCED];
    const issueSkillLevel = skillLevels.find(level => issueLabels.includes(level));
    
    if (!issueSkillLevel) {
        const msg = buildNoSkillLevelComment(requester);
        return await context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: msg });
    }

    // GATE 5: Enforce Assignment Limit (MAX 2 OPEN ISSUES)
    const openSearchQuery = `repo:${owner}/${repo} is:issue is:open assignee:${requester} -label:"${LABELS.BLOCKED}"`;
    const openSearch = await context.octokit.search.issuesAndPullRequests({ q: openSearchQuery });
    const currentOpenAssignments = openSearch.data.total_count;

    if (currentOpenAssignments >= MAX_OPEN_ASSIGNMENTS) {
        const msg = buildAssignmentLimitExceededComment(requester, currentOpenAssignments);
        return await context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: msg });
    }

    // GATE 6: Check Skill Prerequisites
    const prereq = SKILL_PREREQUISITES[issueSkillLevel];
    if (prereq.requiredLabel && prereq.requiredCount > 0) {
        const closedSearchQuery = `repo:${owner}/${repo} is:issue is:closed assignee:${requester} label:"${prereq.requiredLabel}"`;
        const closedSearch = await context.octokit.search.issuesAndPullRequests({ q: closedSearchQuery });
        const completedCount = closedSearch.data.total_count;

        if (completedCount < prereq.requiredCount) {
            const msg = buildPrerequisiteNotMetComment(requester, issueSkillLevel, completedCount);
            return await context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: msg });
        }
    }

    // GATE 7: The Assignment!
    await context.octokit.issues.addAssignees({ owner, repo, issue_number: issue.number, assignees: [requester] });
    
    // Send Welcome Message
    const welcomeMsg = buildWelcomeComment(requester, issueSkillLevel);
    await context.octokit.issues.createComment({ owner, repo, issue_number: issue.number, body: welcomeMsg });

    // GATE 8: Update Labels
    try {
        await context.octokit.issues.removeLabel({ owner, repo, issue_number: issue.number, name: LABELS.READY_FOR_DEV });
    } catch (e) { /* Ignore if label doesn't exist just in case */ }
    
    await context.octokit.issues.addLabels({ owner, repo, issue_number: issue.number, labels: [LABELS.IN_PROGRESS] });
}