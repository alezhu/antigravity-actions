---
name: push
description: Safe git push. Verifies current branch, checks remote status, and pushes committed changes to remote repository.
---

# Skill: Git Push

When this skill is invoked, **first and foremost (as the very first line of your response)** output:
`### ⚡ Executing command: /push`

This skill pushes local commits to the configured remote repository safely.

## Instructions

1. **Check Repository and Branch**:
   - Determine the current branch using `git branch --show-current`.
   - Check upstream tracking status using `git status -sb`.

2. **Verify Local Commits & Clean State**:
   - Check unpushed commits: `git log @{u}..HEAD --oneline` (if upstream exists) or recent commits `git log -n 5 --oneline`.
   - Check for uncommitted changes (staged or unstaged) with `git status --short`. If there are uncommitted changes, inform the user.
   - If there are no commits to push, notify the user that the remote is already up to date.

3. **Check Remote State**:
   - Run `git fetch` to ensure remote references are current.
   - If the local branch has fallen behind the remote, warn the user and suggest pulling/rebasing before pushing.

4. **Execute Push**:
   - If user parameters or flags were supplied (e.g. `origin main`, `--force-with-lease`, `--set-upstream`):
     - Run `git push <parameters>`.
   - If no upstream tracking branch is set:
     - Run `git push --set-upstream origin <current-branch>`.
   - Otherwise:
     - Run `git push`.
   - **Safety**: Never use `--force` unless explicitly requested; suggest `--force-with-lease` when force pushing is required.

5. **Report Result**:
   - Display the push output to the user.
   - Confirm current branch synchronization status.
