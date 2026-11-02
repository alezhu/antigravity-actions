# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Dynamic Action Discovery from `skills/`**: Actions are now automatically discovered from subfolders in the `skills/` directory. Simply create a new subfolder in `skills/` to register an action on the panel.
- **Per-Skill Configuration & Localizations**: Each skill subfolder now supports `action.json` (action configuration), custom icons (`icon.svg`, `icon.png`, or emojis), and dedicated translations (`locales/en.json`, `locales/ru.json`).
- **Dynamic UI Rendering**: Action cards, inputs, and Settings visibility switches are rendered dynamically from discovered skills.
- **Self-Contained Bilingual Skills**: Added Russian skill instructions (`SKILL.ru.md`) and dedicated localized action dictionaries for `run-tests`, `code-review`, `commit`, `push`, and `release`.
- **Live File Watcher for `skills/`**: Changes or additions to skills trigger instant live-reload in the Actions Panel.

## [1.1.0] - 2026-11-01

### Added
- **Push Action & Skill (`/push`)**: Added safe Git push workflow (`skills/push/SKILL.md`) that verifies current branch, checks upstream sync status, and requests confirmation before pushing.
- **Drag-and-Drop Action Reordering**: Action cards can now be dynamically reordered via drag-and-drop.
- **Order Persistence & Reset**: Custom action order is saved to `localStorage` and automatically restored; added a reset button (`↺`) to restore the default order.
- **4 Action Execution Modes**: Support for Direct Execute via RPC, Slash Command injection, Expanded Prompt, and Clipboard Copy modes.
- **Tabs Navigation & UI Expansion**: Added tabs for **Actions**, **Settings** (customizable execution mode, command visibility toggle), and **About** (plugin metadata, version, repository links).
- **Internationalization (i18n)**: Full bilingual UI localization supporting English (`en`) and Russian (`ru`).
- **Antigravity Connect RPC Integration**: Native communication with Antigravity Language Server via Connect RPC (`SendUserCascadeMessage`, `GetAllPlugins`, `GetWorkspaceDirectories`) with real-time execution status.
- **Plugin Synchronization Rule**: Added automated mirroring rules to ensure immediate sync with Antigravity installed plugins directory.

### Changed
- **Default Actions Order**: Standardized default action flow: **Run Tests**, **Code Review**, **Commit**, **Push**, **Release**.
- **Bilingual Documentation**: Updated README in both English and Russian.

### Removed
- **Deploy Action (`/deploy`)**: Replaced deprecated deploy workflow in favor of push.

### Fixed
- **Live Reload & Panel Styling**: Added auto-refresh mechanism for sidecar web UI and adjusted container padding.
- **Concurrency & Loop Prevention**: Guarded against concurrent action runs and eliminated infinite cancel logging loops.
- **Session & Workspace Binding**: Bound new conversations to current workspace directory and localized agent prompts.
- **Model Assignment Protection**: Passed `plannerConfig.planModel` in cascade messages to prevent unassigned model crashes.
- **Dynamic SDK Preload**: Resolved sidecar SDK preload path dynamically across different host environments.

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
