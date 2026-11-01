---
name: run-tests
description: Automatically detects project test framework, runs test suites, diagnoses test failures, and suggests patches.
---

# Skill: Run Tests & Diagnostics

When this skill is invoked, **first and foremost (as the very first line of your response)** output:
`### ⚡ Executing command: /run-tests`

## Instructions

1. **Detect Test Runner**:
   - Node.js / TypeScript: inspect `package.json` (`npm test`, `pnpm test`, `yarn test`, `bun test`, vitest, jest, mocha, playwright).
   - Python: detect `pytest`, `unittest`, `manage.py test`, `tox`.
   - Go: `go test ./...`.
   - Rust: `cargo test`.
   - .NET / C#: `dotnet test`.

2. **Run Tests**:
   - Execute the test suite in the workspace.
   - If the user supplied a specific test path or pattern, run only the targeted tests.

3. **Analyze Test Results**:
   - If **all tests passed**:
     - Provide a concise summary (number of passed tests, duration).
   - If **any tests failed**:
     - Highlight failing tests and their stack traces.
     - Inspect the code of the failing test and tested module.
     - Explain the root cause clearly.
     - Propose a clean fix/diff or apply it if the user authorized fixes.
   - Output analysis in English (or the user's requested language).
