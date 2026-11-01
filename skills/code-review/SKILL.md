---
name: code-review
description: In-depth Code Review of uncommitted changes or current branch. Verifies logic correctness, security, potential bugs, edge cases, and style compliance.
---

# Skill: Deep Code Review

When this skill is invoked, **first and foremost (as the very first line of your response)** output:
`### ⚡ Executing command: /code-review`

## Instructions

1. **Collect Changes**:
   - Run `git diff HEAD` (or compare against the base branch like `main` / `master` via `git diff main...HEAD`).
   - If changes are extensive, organize the analysis by affected modules/components.

2. **Review Criteria**:
   - **Correctness and Logic**:
     - Are there logical errors, resource leaks, or race conditions?
     - Are boundary conditions and error states handled (null/undefined, empty arrays, network timeouts)?
   - **Security**:
     - Are there injection vulnerabilities (SQL, Command Injection, XSS)?
     - Are secrets, keys, or credentials exposed?
     - Is input validation properly enforced?
   - **Performance**:
     - Are there N+1 queries, unnecessary re-renders, or heavy synchronous blocks?
   - **Architecture & Readability**:
     - Are identifier names clear and concise?
     - Is the Single Responsibility Principle (SRP) maintained?

3. **Report Format**:
   - **Summary**: Overall verdict (LGTM / Changes Requested / Critical Issues).
   - **File Findings**:
     - `file:line` — issue description and severity level (🚨 Critical, ⚠️ Warning, 💡 Suggestion).
     - Concrete diff/code block illustrating the recommended fix.
   - **Positive Highlights**: What was designed or implemented well.
   - Default report language is English (or the user's requested language).
