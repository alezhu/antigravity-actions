---
name: release
description: Release preparation and management. Computes Semantic Versioning (SemVer), generates Changelog, bumps manifest version, and creates Git tag.
---

# Skill: Smart Release Management

When this skill is invoked, **first and foremost (as the very first line of your response)** output:
`### ⚡ Executing command: /release`

This skill automates release preparation following Semantic Versioning (SemVer).

## Instructions

1. **Analyze Commit History**:
   - Locate latest tag: `git describe --tags --abbrev=0` (or `git tag -l`).
   - Retrieve commits since last release: `git log <last-tag>..HEAD --oneline`.
   - Analyze Conventional Commits:
     - `feat!:` or `BREAKING CHANGE:` -> increment **MAJOR** (`1.0.0` -> `2.0.0`).
     - `feat:` -> increment **MINOR** (`1.0.0` -> `1.1.0`).
     - `fix:` / `perf:` / `refactor:` -> increment **PATCH** (`1.0.0` -> `1.0.1`).

2. **Confirm Version**:
   - Propose calculated next version to the user.

3. **Bump Manifests**:
   - Update version in `package.json`, `Cargo.toml`, `pyproject.toml`, `VERSION`, `plugin.json` or project equivalent.

4. **Generate / Update CHANGELOG.md**:
   - Add section for the new version with current date.
   - Categorize entries:
     - 🚀 Features
     - 🐛 Bug Fixes
     - ⚡ Performance Improvements
     - 📝 Documentation & Maintenance

5. **Create Release Commit, Git Tag & Push**:
   - Stage and commit: `git commit -am "chore(release): vX.Y.Z"`.
   - Create annotated tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
   - Push release and tags to remote: `git push origin && git push origin --tags`.
