import { handleAssign } from './commands/assign.js';

export default (app) => {
  app.log.info("Hiero Centralized Workflow Service is running!");

  app.on("issue_comment.created", async (context) => {
    const issue = context.payload.issue;
    const comment = context.payload.comment;

    // 1. Guardrail: Ignore comments on Pull Requests
    if (issue.pull_request) {
      app.log.info("Ignored PR comment");
      return;
    }

    // 2. Guardrail: Ignore comments made by bots
    if (context.isBot) {
      app.log.info("Ignored bot comment");
      return;
    }

    // 3. Parse the comment body for the /assign command
    const body = comment.body;
    
    // This regex checks if the user typed exactly "/assign"
    if (/^\s*\/assign\s*$/i.test(body)) {
      app.log.info(`Detected /assign command from: ${comment.user.login}`);
      
      // 4. FIRE THE LOGIC!
      try {
          await handleAssign(context);
      } catch (error) {
          app.log.error(`Error handling assignment: ${error.message}`);
      }
    }
  });
};