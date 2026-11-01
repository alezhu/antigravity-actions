# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-01

### Added
- **Interactive UI Sidecar**: Auxiliary pane web dashboard for Antigravity desktop application.
  - Real-time Git status monitor (branch, staged/modified file counter, last commit).
  - Quick action buttons with one-click triggers for Commit, Code Review, Run Tests, Deploy, and Release.
  - Built-in terminal log output with automatic polling and refresh.
  - One-click prompt copying to Antigravity chat with formatted instructions.
- **Skills & Slash Commands**:
  - `/commit`: Automatically inspects diff, generates Conventional Commit message, stages files, and commits.
  - `/code-review`: Deep code review for correctness, security vulnerabilities, edge cases, and performance.
  - `/run-tests`: Auto-detects project test framework (Node, Python, Go, Rust, .NET), runs suite, and diagnoses errors.
  - `/deploy`: Safe deployment workflow with branch validation, clean repo check, linting, tests, and build steps.
  - `/release`: SemVer release preparation, changelog generation, and Git tag creation.
- **Chat Canvas Integration**:
  - Quick action prompt chips (`suggestedPrompts`) displayed in Antigravity chat.
- **Marketplace Readiness**:
  - Project manifest (`plugin.json`), logo, and MIT license.
