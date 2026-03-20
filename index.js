import { handleAssign } from "./commands/assign.js";

const ASSIGN_COMMAND = /^\s*\/assign\s*$/i;

export default (app) => {
  app.log.info("Hiero Centralized Workflow Service is running!");

  app.on("issue_comment.created", async (context) => {
    const { issue, comment } = context.payload;

    if (issue.pull_request) return app.log.info("Ignored PR comment");
    if (context.isBot) return app.log.info("Ignored bot comment");

    if (!ASSIGN_COMMAND.test(comment.body)) return;

    app.log.info(`Detected /assign command from: ${comment.user.login}`);

    try {
      await handleAssign(context);
    } catch (error) {
      app.log.error(`Error handling assignment: ${error.message}`);
    }
  });

  // NEW: PR Opened/Reopened Orchestrator (from bot-on-pr-open.js)
  app.on(["pull_request.opened", "pull_request.reopened"], async (context) => {
    app.log.info(
      `PR Opened/Reopened: ${context.payload.pull_request.html_url}`,
    );

    if (context.isBot || context.payload.pull_request.user.type === "Bot") {
      return app.log.info("Skipping bot-authored PR");
    }

    const prAuthor = context.payload.pull_request.user.login;
    const currentAssignees = context.payload.pull_request.assignees || [];

    // 1. Auto-assign Author
    const isAlreadyAssigned = currentAssignees.some(
      (a) => (a?.login || "").toLowerCase() === prAuthor.toLowerCase(),
    );
    if (!isAlreadyAssigned) {
      await addAssignees(context, [prAuthor]);
      app.log.info(`Auto-assigned author ${prAuthor} to PR`);
    }

    // 2. Run Checks and Swap Labels
    try {
      const { allPassed } = await runAllChecksAndComment(context);
      await swapStatusLabel(context, allPassed, true); // force = true
      app.log.info("On-PR-open bot completed successfully");
    } catch (error) {
      app.log.error(`Error processing PR Open: ${error.message}`);
    }
  });

  // NEW: PR Updated Orchestrator (from bot-on-pr-update.js)
  app.on(
    ["pull_request.synchronize", "pull_request.edited"],
    async (context) => {
      app.log.info(`PR Updated: ${context.payload.pull_request.html_url}`);

      if (context.isBot || context.payload.pull_request.user.type === "Bot") {
        return app.log.info("Skipping bot-authored PR");
      }

      // Edits can be triggered by title changes, but we only care about body changes for Issue Links.
      if (
        context.payload.action === "edited" &&
        !context.payload.changes?.body
      ) {
        return app.log.info("Body not changed, skipping PR edit check");
      }

      try {
        const { allPassed } = await runAllChecksAndComment(context);
        await swapStatusLabel(context, allPassed, false);
        app.log.info("On-PR-update bot completed successfully");
      } catch (error) {
        app.log.error(`Error processing PR Update: ${error.message}`);
      }
    },
  );
};
