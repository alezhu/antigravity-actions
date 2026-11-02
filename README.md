# Antigravity Actions ⚡

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Antigravity](https://img.shields.io/badge/Antigravity-Plugin-purple.svg)](https://antigravity.google)

English | [Русский](README.ru.md)

A productivity plugin for Google Antigravity that adds one-click developer workflows: **Run Tests**, **Code Review**, **Commit**, **Push**, and **Release**.

---

## Features

### 1. Interactive Auxiliary Pane (UI Sidecar)
* **Drag-and-Drop Reordering**: Easily reorder action cards by dragging them; custom order is automatically saved and persisted. Default order: **Run Tests**, **Code Review**, **Commit**, **Push**, **Release**. Includes one-click reset (`↺`).
* **One-Click Actions**: Trigger actions directly or copy ready-to-use AI prompts into chat with a single click.
* **Internationalization (i18n)**: English default with Russian localization included, dynamic language switcher, translatable command prompts, and automatic fallback to English for missing keys.
* **Integrated Console**: View command outputs and status logs directly in the side pane.
* **Native Theme Matching**: Adapts seamlessly to light and dark Antigravity themes.

### 2. Built-in Skills & Slash Commands
* `/run-tests` — Automatically detects the project test runner, executes tests, and diagnoses failures.
* `/code-review` — Performs an in-depth review of uncommitted changes (logic errors, security vulnerabilities, edge cases, and code style).
* `/commit` — Inspects `git diff`, creates a descriptive Conventional Commit message, and commits.
* `/push` — Safely pushes committed changes to the remote repository.
* `/release` — Determines the next SemVer version, updates changelog, and creates an annotated Git tag.

### 3. Modular Architecture: Add Actions Easily via `skills/`
You can add custom actions simply by creating subfolders in `skills/`:
* Each subfolder is self-contained: provides `SKILL.md`, `action.json`, custom `icon.svg`, and localized strings (`locales/en.json`, `locales/ru.json`).
* Dynamic discovery: newly created skills appear automatically on the Actions Panel with live-reload!

### 4. Suggested Prompt Chips
* Instant quick-action chips displayed in the Antigravity chat canvas.

---

## Installation

### Global Installation (User-wide)
Clone the repository directly into your Antigravity plugins directory:

**Windows (PowerShell):**
```powershell
git clone https://github.com/alezhu/antigravity-actions.git "$env:USERPROFILE\.gemini\config\plugins\antigravity-actions"
```

**macOS / Linux:**
```bash
git clone https://github.com/alezhu/antigravity-actions.git ~/.gemini/config/plugins/antigravity-actions
```

### Project-Scoped Installation (Workspace)
To enable the plugin only within a specific project repository, clone or copy it into the project's `.agents/plugins/` directory:

```bash
git clone https://github.com/alezhu/antigravity-actions.git .agents/plugins/antigravity-actions
```

> **Note:** After installation, restart Antigravity or open a new conversation to load the new skills and UI panel.

---

## Usage

1. **Open the Actions Panel**: Click the Actions Panel icon in the top-right corner of the Auxiliary Pane, or trigger it via the chat link:
   ```markdown
   [⚡ Actions Panel](sidecar://antigravity-actions/actions-panel)
   ```
2. **Use Slash Commands**: In the chat input, type `/` and choose from `/run-tests`, `/code-review`, `/commit`, `/push`, or `/release`.
3. **Use Prompt Chips**: Click on any of the suggested prompt chips appearing above or within the conversation.

---

## Adding New Actions & Skills

Adding a new action to the panel is as simple as creating a new folder in `skills/<skill-name>/`:

```text
skills/my-action/
├── SKILL.md                 # Antigravity skill instructions
├── action.json              # Action configuration (command, icon, order)
├── icon.svg                 # SVG icon (or emoji in action.json)
└── locales/
    ├── en.json              # English action name, desc, prompts
    └── ru.json              # Russian action name, desc, prompts
```

### `action.json` Example:
```json
{
  "id": "my-action",
  "command": "/my-action",
  "order": 10,
  "icon": "icon.svg",
  "emoji": "⚡",
  "hasInput": true
}
```

### `locales/en.json` Example:
```json
{
  "name": "My Action",
  "desc": "/my-action — perform custom task",
  "placeholder": "Arguments (optional)",
  "displayTitle": "⚡ My Action",
  "promptTemplate": "/my-action",
  "promptTemplateWithInput": "/my-action {input}",
  "prompt": "Full AI prompt instruction..."
}
```

The Actions Panel automatically discovers new actions, loads their icons and translations, and live-reloads in real time!

---

## Project Structure

```text
antigravity-actions/
├── plugin.json                 # Plugin manifest and metadata
├── package.json                # Node.js package description
├── LICENSE                     # MIT License
├── CHANGELOG.md                # Release history and updates
├── README.md                   # Documentation (English)
├── README.ru.md                # Documentation (Russian)
├── assets/
│   └── logo.svg                # Plugin icon
├── skills/                     # Self-contained actions & skills
│   ├── run-tests/              # Run Tests action
│   │   ├── SKILL.md            # Skill instructions
│   │   ├── action.json         # Action config
│   │   ├── icon.svg            # Custom SVG icon
│   │   └── locales/            # Localized strings (en.json, ru.json)
│   ├── code-review/
│   ├── commit/
│   ├── push/
│   └── release/
└── sidecars/
    └── actions-panel/          # Sidecar Web UI
        ├── sidecar.json        # Sidecar declaration
        ├── server.mjs          # Standalone Node.js server
        ├── locales/            # Core panel UI translations
        │   ├── en.json         # English
        │   └── ru.json         # Russian
        └── public/             # Web dashboard frontend
            ├── index.html
            ├── style.css
            └── app.js
```

---

## License

This project is licensed under the [MIT License](LICENSE).
