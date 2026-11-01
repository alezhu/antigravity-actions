# Antigravity Actions ⚡

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Antigravity](https://img.shields.io/badge/Antigravity-Plugin-purple.svg)](https://antigravity.google)

[English](README.md) | Русский

Плагин для Google Antigravity, добавляющий быстрые действия для разработчика в один клик: **Run Tests**, **Code Review**, **Commit**, **Push** и **Release**.

---

## Возможности

### 1. Интерактивная боковая панель (UI Sidecar)
* **Перетаскивание карточек (Drag-and-Drop)**: порядок действий можно легко менять перетаскиванием карточек; выбранный порядок сохраняется автоматически. Порядок по умолчанию: **Run Tests**, **Code Review**, **Commit**, **Push**, **Release**. Предусмотрена кнопка сброса к исходному порядку (`↺`).
* **Действия в один клик**: запуск действий напрямую или копирование готовых AI-промптов в чат по одной кнопке.
* **Интернационализация и локализация (i18n)**: английский интерфейс по умолчанию с возможностью переключения на русский, динамическое определение доступных языков из `locales/*.json`, локализация промптов команд и автоматический fallback на английский при отсутствии перевода.
* **Встроенная консоль**: просмотр вывода команд и логов прямо во вспомогательной панели (Auxiliary Pane).
* **Поддержка тем**: автоматическая адаптация под светлую и темную темы Antigravity.

### 2. Встроенные навыки и слэш-команды
* `/run-tests` — определяет тестовый фреймворк проекта, запускает тесты и диагностирует падения.
* `/code-review` — проводит глубокое ревью изменений (логические ошибки, безопасность, граничные случаи и кодстайл).
* `/commit` — анализирует `git diff`, генерирует понятное сообщение по Conventional Commits и делает коммит.
* `/push` — безопасно отправляет закоммиченные изменения в удаленный репозиторий.
* `/release` — вычисляет следующую версию по SemVer, обновляет журнал изменений (changelog) и создает Git-тег.

### 3. Быстрые кнопки в чате (Suggested Prompts)
* Интерактивные чипы частых действий прямо в строке чата Antigravity.

---

## Установка

### Глобальная установка (для всей системы)
Клонируйте репозиторий в каталог плагинов Antigravity:

**Windows (PowerShell):**
```powershell
git clone https://github.com/alezhu/antigravity-actions.git "$env:USERPROFILE\.gemini\config\plugins\antigravity-actions"
```

**macOS / Linux:**
```bash
git clone https://github.com/alezhu/antigravity-actions.git ~/.gemini/config/plugins/antigravity-actions
```

### Установка для конкретного проекта (Workspace)
Чтобы плагин работал только в конкретном репозитории, поместите его в папку `.agents/plugins/`:

```bash
git clone https://github.com/alezhu/antigravity-actions.git .agents/plugins/antigravity-actions
```

> **Примечание:** После установки перезапустите Antigravity или откройте новый диалог, чтобы приложение подгрузило навыки и панель.

---

## Использование

1. **Открыть Actions Panel**: нажмите на иконку Actions Panel в верхнем правом углу панели Auxiliary Pane или перейдите по ссылке в чате:
   ```markdown
   [⚡ Actions Panel](sidecar://antigravity-actions/actions-panel)
   ```
2. **Использовать слэш-команды**: введите `/` в строке ввода чата и выберите `/run-tests`, `/code-review`, `/commit`, `/push` или `/release`.
3. **Использовать кнопки в чате**: нажмите на любой из появившихся интерактивных чипов подсказок.

---

## Структура проекта

```text
antigravity-actions/
├── plugin.json                 # Манифест плагина и метаданные
├── package.json                # Конфигурация Node.js пакета
├── LICENSE                     # Лицензия MIT
├── CHANGELOG.md                # История изменений
├── README.md                   # Документация (на английском)
├── README.ru.md                # Документация (на русском)
├── assets/
│   └── logo.svg                # Логотип плагина
├── skills/                     # Навыки Antigravity (Skills)
│   ├── run-tests/SKILL.md
│   ├── code-review/SKILL.md
│   ├── commit/SKILL.md
│   ├── push/SKILL.md
│   └── release/SKILL.md
└── sidecars/
    └── actions-panel/          # Веб-панель Sidecar
        ├── sidecar.json        # Декларация sidecar
        ├── server.mjs          # Сервер Node.js
        ├── locales/            # Словари локализации
        │   ├── en.json         # Английский (базовый)
        │   └── ru.json         # Русский
        └── public/             # Фронтенд панели
            ├── index.html
            ├── style.css
            └── app.js
```

---

## Лицензия

Проект распространяется под лицензией [MIT](LICENSE).
