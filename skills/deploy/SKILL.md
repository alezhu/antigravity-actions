---
name: deploy
description: Safe project deployment. Validates repository clean state, runs linters/tests, builds artifacts, and triggers the deployment pipeline.
---

# Skill: Safe Deploy

When this skill is invoked, **first and foremost (as the very first line of your response)** output:
`### ⚡ Executing command: /deploy`

This skill performs a controlled, verified deployment to the target environment (staging/production).

## Instructions

1. **Pre-flight Checks**:
   - Verify current branch (`git branch --show-current`). Production deploys typically originate from `main` / `master` or a release branch.
   - Check `git status`: warn if there are uncommitted local changes.
   - Verify local branch is up to date with remote (`git fetch && git status -uno`).

2. **Quality Validation (CI Steps)**:
   - Run linter and type checker (e.g. `npm run lint`, `tsc --noEmit`).
   - Run tests (`npm test` or project equivalent). If tests fail, **abort deployment immediately**.

3. **Build**:
   - Run the production build command (`npm run build`, `docker build`, etc.).
   - Verify build completes without errors.

4. **Deploy**:
   - Run the project deployment command (e.g. `npm run deploy`, `docker compose up -d`, `vercel --prod`, `firebase deploy`, `kubectl apply`, or project deployment script).
   - Ask for explicit user confirmation before executing on Production.

5. **Post-deploy Verification**:
   - Check deployed service health (healthcheck URL, HTTP status).
   - Report final deployment status.
