# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-11-01

### Added
- **Push Action & Skill (`/push`)**: Added safe Git push workflow (`skills/push/SKILL.md`) that verifies branch, checks upstream sync status, and pushes commits.
- **Drag-and-Drop Action Reordering**: Action cards can now be dynamically reordered via drag-and-drop.
- **Order Persistence & Reset**: Custom action order is saved to `localStorage` and automatically restored; added reset button (`↺`) to restore the default order.
- **Default Actions Order**: Actions are ordered by default as **Run Tests**, **Code Review**, **Commit**, **Push**, **Release**.

### Removed
- **Deploy Action & Skill (`/deploy`)**: Removed deploy workflow in favor of push.

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
