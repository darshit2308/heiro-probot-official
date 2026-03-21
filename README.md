<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0a0a0a,50:1a1a2e,100:16213e&height=180&section=header&text=Hiero%20Workflow%20Probot&fontSize=42&fontColor=ffffff&fontAlignY=38&desc=One%20service.%20Every%20repository.%20Zero%20duplication.&descSize=15&descAlignY=58&animation=fadeIn" width="100%"/>

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Probot](https://img.shields.io/badge/Probot-Framework-2671E5?style=for-the-badge&logo=github&logoColor=white)](https://probot.github.io)
[![Octokit](https://img.shields.io/badge/Octokit-REST%20%2B%20GraphQL-181717?style=for-the-badge&logo=github&logoColor=white)](https://octokit.github.io)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge)](LICENSE)

</div>

---

## The Problem

The Hiero organisation currently maintains **duplicated bot logic** across every repository. Each repo has its own YAML workflows and JavaScript scripts. Changing one rule means touching every repo — a maintenance nightmare that doesn't scale.

```
Before:  hiero-sdk-cpp/.github/scripts/  ←  4 JS files + 3 YAML workflows
         hiero-sdk-js/.github/scripts/   ←  4 JS files + 3 YAML workflows
         hiero-sdk-java/.github/scripts/ ←  4 JS files + 3 YAML workflows
         ... × every repo in the org

After:   hiero-workflow-probot/          ←  1 centralised service
                                             installed with a single click
```

---

## The Solution

A single **Probot GitHub App** that replaces all per-repo bot logic. Install it on any Hiero repository with one click. Update the logic once — every repo benefits instantly.

---

## What It Does

### Issue Management — `issue_comment` event

| Command | Behaviour |
|---|---|
| `/assign` | Validates skill tier, checks assignment limits, enforces prerequisites, assigns contributor, swaps labels |
| `/unassign` | Verifies authorization (case-insensitive), removes assignee, reverts labels, notifies on failure |

**Assignment Gates (in order):**
1. ✅ Acknowledge with 👍 reaction
2. 🔒 Already assigned? → Post informative comment
3. 🏷️ Missing `status: ready for dev`? → Block and explain
4. 🎯 No skill level label? → Tag maintainers
5. 📊 Open assignment limit reached? → Block with current count
6. 🎓 Prerequisites not met? → Show progress and required count
7. ✅ Assign + post welcome comment + swap labels

---

### PR Orchestration — `pull_request` event

When a PR is opened, reopened, or updated, the bot runs a **10-step validation pipeline**:

```
Webhook fires
    │
    ├─ 1. Auto-assign PR author
    ├─ 2. Paginate and fetch all commits
    ├─ 3. DCO Sign-off check  (regex on every commit message)
    ├─ 4. GPG Signature check (cryptographic verification)
    ├─ 5. Merge conflict poll (up to 5 retries × 2s delay)
    ├─ 6. Parse PR body for closing keywords (Fixes #N)
    ├─ 7. GraphQL closingIssuesReferences fallback
    ├─ 8. Cross-reference: is the author assigned to linked issues?
    ├─ 9. Build unified Markdown dashboard comment
    └─ 10. Post/update comment + swap status label
```

**Unified Dashboard Comment** — a single live comment that updates on every push:

```
✅ DCO Sign-off       — All commits have valid sign-offs.
✅ GPG Signature      — All commits have verified GPG signatures.
✅ Merge Conflicts    — No merge conflicts detected.
❌ Issue Link         — You are not assigned to #42.
                        Comment /assign on the issue to grab it!
```

---

## Architecture

```
hiero-workflow-probot/
├── index.js                    ← Event router (entry point)
│
├── commands/
│   ├── assign.js               ← /assign logic (7 gates)
│   ├── assign-comments.js      ← /assign comment builders
│   ├── unassign.js             ← /unassign logic
│   └── unassign-comments.js    ← /unassign comment builders
│
├── helpers/
│   ├── api.js                  ← Octokit wrappers (labels, assignees, comments)
│   ├── checks.js               ← DCO, GPG, merge conflict, issue link
│   ├── comments.js             ← Unified PR dashboard builder
│   ├── constants.js            ← Labels, skill levels, prerequisites
│   └── validation.js           ← Input sanitisation
│
└── config/
    └── hiero-constants.js      ← Org-wide configuration
```

**Why Probot over GitHub Actions?**

| | GitHub Actions (per-repo) | Probot (centralised) |
|---|---|---|
| Install on new repo | Copy 7 files manually | Click "Install App" |
| Update logic | Edit every repo | Edit one service |
| Horizontal scaling | ❌ Impossible | ✅ Instant |
| Service toggles | ❌ Not supported | ✅ Via config file |
| API calls | `actions/github-script` | Native Octokit |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A GitHub App with the following permissions:
  - Issues: Read & Write
  - Pull Requests: Read & Write
  - Contents: Read

### Installation

```bash
git clone https://github.com/darshit2308/hiero-workflow-probot
cd hiero-workflow-probot
npm install
```

Create a `.env` file:

```env
APP_ID=your_app_id
PRIVATE_KEY=your_private_key
WEBHOOK_SECRET=your_webhook_secret
```

Run locally:

```bash
npm start
```

---

## Skill Progression System

The `/assign` command enforces a structured contributor progression:

```
Good First Issue  →  no prerequisites
      ↓
Beginner          →  2 completed Good First Issues
      ↓
Intermediate      →  3 completed Beginner Issues
      ↓
Advanced          →  3 completed Intermediate Issues
```

**Bypass logic:** Contributors who have already completed issues at the same or higher level are automatically bypassed past prerequisites — no manual maintainer intervention required.

**Assignment limit:** Contributors are capped at **2 open issues** at a time. Issues with `status: blocked` do not count toward this limit.

---

## Compared to the Existing Architecture

The existing `hiero-sdk-cpp` bot runs via GitHub Actions:

```
4 JS files × N repos  +  3 YAML files × N repos  =  7N files to maintain
```

This Probot replaces all of that:

```
1 centralised service  =  7N → 1
```

A logic change that previously required N pull requests across N repositories now requires **one commit** to one service.

---

## Contributing

This project follows the same contribution standards as the broader Hiero ecosystem — DCO sign-off, GPG signatures, and issue-linked PRs required.

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:16213e,50:1a1a2e,100:0a0a0a&height=80&section=footer" width="100%"/>

**Built for [LFDT Mentorship 2026](https://github.com/hiero-ledger/tsc/issues/73) · Hiero Ledger**

</div>
