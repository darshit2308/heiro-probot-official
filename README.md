# Hiero Workflow Service (Probot POC)

A **Proof of Concept (POC)** demonstrating how to horizontally scale Hiero's repository bots using a centralized **GitHub App built with Probot**.

---

## Overview

The Hiero Workflow Service replaces decentralized GitHub Action bots with a **single centralized automation service**.

Instead of maintaining identical bot logic across multiple repositories, the automation is hosted once and installed at the **organization level**, enabling scalable and maintainable repository automation.

---

## The Problem

The current Hiero C++ SDK uses **repository-level GitHub Actions** (for example `.github/workflows/on-comment.yaml`) to handle bot commands.

While functional, this approach introduces several challenges:

* Bot logic must be duplicated across every repository.
* Workflow YAML and JavaScript scripts need to be manually maintained.
* Updates require modifying multiple repositories.
* Automation logic becomes harder to scale across the organization.

---

## The Solution

This project ports the existing automation logic into a **centralized Probot service**.

The bot runs as a **GitHub App**, allowing the same automation logic to operate across multiple repositories without duplication.

Key improvements:

* **Zero Duplication**
  The bot is deployed once and installed at the organization level.

* **Native GitHub API Usage**
  Replaces `github-script` wrappers with direct `context.octokit` API calls.

* **Centralized Automation**
  All repository workflow logic is maintained in one service.

---

## Proof of Concept: `/assign` Command

The current proof of concept implements the `/assign` command.

The logic has been fully ported from the original GitHub Action workflow into:

```
/commands/assign.js
```

The implementation preserves the exact **8-Gate validation system** used in the existing workflow.

### Validation Steps

1. **State Validation**
   Ignores pull requests and bot-generated comments.

2. **Label Validation**
   Ensures the issue has the label:

   ```
   status: ready for dev
   ```

3. **Skill Level Detection**

   Detects issue difficulty via labels such as:

   * `skill: good first issue`
   * `skill: intermediate`
   * `skill: advanced`

4. **Open Assignment Limits**

   Limits users to a maximum of **2 active assignments**.

5. **Skill Prerequisite Validation**

   Ensures contributors satisfy prerequisite skill requirements before assignment.

6. **Automated Label Transition**

   Automatically updates labels when an issue is assigned:

   ```
   status: ready for dev  →  status: in progress
   ```

---

## Architecture

```
GitHub Organization
        │
        ▼
GitHub App (Probot Service)
        │
        ▼
Command Handlers
        │
        ├── /assign
        ├── /label
        └── future commands
```

This architecture allows the service to scale horizontally across multiple repositories while maintaining a single automation codebase.

---

## Future Scope

This proof of concept can be extended to support additional repository automation features such as:

* `/unassign` commands
* automatic issue triaging
* pull request labeling
* contributor progression tracking
* automated project board updates

---

## Tech Stack

* **Probot**
* **Node.js**
* **GitHub Apps API**
* **Octokit**
