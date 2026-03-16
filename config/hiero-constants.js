export const MAINTAINER_TEAM = '@hiero-ledger/hiero-sdk-cpp-maintainers';

export const LABELS = Object.freeze({
    READY_FOR_DEV:    'status: ready for dev',
    IN_PROGRESS:      'status: in progress',
    BLOCKED:          'status: blocked',
    GOOD_FIRST_ISSUE: 'skill: good first issue',
    BEGINNER:         'skill: beginner',
    INTERMEDIATE:     'skill: intermediate',
    ADVANCED:         'skill: advanced',
});

export const ISSUE_STATE = Object.freeze({
    OPEN:   'open',
    CLOSED: 'closed',
});

export const MAX_OPEN_ASSIGNMENTS = 2;

export const SKILL_PREREQUISITES = {
    [LABELS.GOOD_FIRST_ISSUE]: {
        requiredLabel:           null,
        requiredCount:           0,
        displayName:             'Good First Issue',
    },
    [LABELS.BEGINNER]: {
        requiredLabel:           LABELS.GOOD_FIRST_ISSUE,
        requiredCount:           2,
        displayName:             'Beginner',
        prerequisiteDisplayName: 'Good First Issues',
    },
    [LABELS.INTERMEDIATE]: {
        requiredLabel:           LABELS.BEGINNER,
        requiredCount:           3,
        displayName:             'Intermediate',
        prerequisiteDisplayName: 'Beginner Issues',
    },
    [LABELS.ADVANCED]: {
        requiredLabel:           LABELS.INTERMEDIATE,
        requiredCount:           3,
        displayName:             'Advanced',
        prerequisiteDisplayName: 'Intermediate Issues',
    },
};


export function buildWelcomeComment(username, skillLevel) {
    const isGoodFirstIssue = skillLevel === LABELS.GOOD_FIRST_ISSUE;
    const skillDisplayName  = SKILL_PREREQUISITES[skillLevel]?.displayName || 'issue';

    if (isGoodFirstIssue) {
        return `👋 Hi @${username}, welcome to the Hiero community! Thank you for choosing to contribute — we're thrilled to have you here! 🎉\n\nYou've been assigned this **Good First Issue**, and the **Good First Issue Support Team** is ready to help you succeed.\n\nThe issue description above has everything you need. If anything is unclear, just ask.\n\nGood luck, and welcome aboard! 🚀`;
    }

    return `👋 Hi @${username}, thanks for continuing to contribute! You've been assigned this **${skillDisplayName}** issue. 🙌\n\nGood luck! 🚀`;
}

export function buildAlreadyAssignedComment(requesterUsername, currentAssignee) {
    if (requesterUsername.toLowerCase() === currentAssignee.toLowerCase()) {
        return `👋 Hi @${requesterUsername}! You're already assigned to this issue. You're all set to start working on it!`;
    }

    return `👋 Hi @${requesterUsername}! This issue is already assigned to @${currentAssignee}. Find another open issue and comment \`/assign\` to get started!`;
}

export function buildNotReadyComment(requesterUsername) {
    return `👋 Hi @${requesterUsername}! This issue is not ready for development yet.\n\nIssues must have the \`${LABELS.READY_FOR_DEV}\` label before they can be assigned.`;
}

export function buildNoSkillLevelComment(requesterUsername) {
    return `👋 Hi @${requesterUsername}! This issue doesn't have a skill level label yet.\n\n${MAINTAINER_TEAM} — could you please add a skill level label? Once added, @${requesterUsername} can comment \`/assign\` again.`;
}

export function buildAssignmentLimitExceededComment(requesterUsername, openCount) {
    return `👋 Hi @${requesterUsername}! Thanks for your enthusiasm!\n\nTo help contributors stay focused, we limit assignments to **${MAX_OPEN_ASSIGNMENTS} open issues** at a time.\n\n📊 **Your Current Assignments:** You're currently assigned to **${openCount}** open issues. Once you complete one, come back and we'll be happy to assign this to you! 🎯`;
}

export function buildPrerequisiteNotMetComment(requesterUsername, skillLevel, completedCount) {
    const prereq = SKILL_PREREQUISITES[skillLevel];

    return `👋 Hi @${requesterUsername}! This is a **${prereq.displayName}** issue.\n\nBefore taking it on, you need to complete at least **${prereq.requiredCount} ${prereq.prerequisiteDisplayName}**.\n\n📊 **Your Progress:** You've completed **${completedCount}** so far. Keep going! 🎯`;
}