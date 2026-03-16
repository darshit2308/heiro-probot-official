import { handleAssign } from './commands/assign.js';

const ASSIGN_COMMAND = /^\s*\/assign\s*$/i;

export default (app) => {
    app.log.info('Hiero Centralized Workflow Service is running!');

    app.on('issue_comment.created', async (context) => {
        const { issue, comment } = context.payload;

        if (issue.pull_request) return app.log.info('Ignored PR comment');
        if (context.isBot)      return app.log.info('Ignored bot comment');

        if (!ASSIGN_COMMAND.test(comment.body)) return;

        app.log.info(`Detected /assign command from: ${comment.user.login}`);

        try {
            await handleAssign(context);
        } catch (error) {
            app.log.error(`Error handling assignment: ${error.message}`);
        }
    });
};