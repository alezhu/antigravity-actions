---
name: commit
description: Automated creation of meaningful git commits. Inspects staged/unstaged changes, generates messages following Conventional Commits, and performs commits.
---

# Skill: Smart Git Commit

When this skill is invoked, **first and foremost (as the very first line of your response)** output:
`### ⚡ Executing command: /commit`

## Instructions

1. **Check Working Directory Status**:
   - Run `git status --short`.
   - If there are no changes, inform the user that the working tree is clean.

2. **Analyze Changes**:
   - Run `git diff --cached` (for staged files) and `git diff` (for unstaged changes).
   - Ensure that temporary files, secrets (`.env`, private keys, access tokens) or build artifacts are not included. If found, warn the user and add them to `.gitignore`.

3. **Staging**:
   - If no files are staged, stage the relevant modified files via `git add <files>` (or `git add -A` if appropriate).

4. **Generate Conventional Commit Message**:
   - Choose the appropriate type prefix:
     - `feat:` new feature
     - `fix:` bug fix
     - `refactor:` code refactoring without behavior change
     - `test:` adding or fixing tests
     - `docs:` documentation updates
     - `chore:` maintenance, dependencies
     - `style:` code style, formatting
   - Compose a concise subject line (up to 72 characters).
   - Add a brief bulleted list of key changes in the commit body if needed.
   - Use English by default (or follow the language of the user's prompt).

5. **Execute Commit**:
   - Run `git commit -m "..."`.
   - Display the commit hash to the user and suggest the next push command: `git push`. (Do not run `git push` autonomously).
