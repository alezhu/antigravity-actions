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

### 3. Модульная архитектура: простое добавление действий через `skills/`
Новые действия и навыки можно добавлять простым созданием подпапки в `skills/`:
* Каждая подпапка полностью самодостаточна: содержит `SKILL.md`, `action.json`, иконку `icon.svg` и локализацию (`locales/ru.json`, `locales/en.json`).
* Динамическое обнаружение: новые действия автоматически появляются в панели Actions Panel с мгновенным live-reload!

### 4. Быстрые кнопки в чате (Suggested Prompts)
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

## Добавление собственных действий и навыков

Добавить новое действие на панель предельно просто — достаточно создать новую папку `skills/<имя-навыка>/`:

```text
skills/my-action/
├── SKILL.md                 # Инструкции и промпт навыка Antigravity
├── action.json              # Конфигурация действия (команда, иконка, порядок)
├── icon.svg                 # SVG-иконка (или эмодзи в action.json)
└── locales/
    ├── ru.json              # Название, описание и промпты на русском
    └── en.json              # Название, описание и промпты на английском
```

### Пример `action.json`:
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

### Пример `locales/ru.json`:
```json
{
  "name": "Мое действие",
  "desc": "/my-action — выполнение пользовательской задачи",
  "placeholder": "Аргументы (необязательно)",
  "displayTitle": "⚡ Мое действие",
  "promptTemplate": "/my-action (отвечай на русском языке)",
  "promptTemplateWithInput": "/my-action {input} (отвечай на русском языке)",
  "prompt": "Полный текст промпта на русском языке..."
}
```

Панель автоматически обнаружит новый навык, загрузит иконки, подключит переводы и обновит интерфейс без перезапуска плагина!

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
├── skills/                     # Модульные действия и навыки
│   ├── run-tests/              # Навык Run Tests
│   │   ├── SKILL.md            # Инструкции навыка
│   │   ├── SKILL.ru.md         # Инструкции на русском
│   │   ├── action.json         # Конфигурация действия
│   │   ├── icon.svg            # Пользовательская SVG-иконка
│   │   └── locales/            # Словари локализации (ru.json, en.json)
│   ├── code-review/
│   ├── commit/
│   ├── push/
│   └── release/
└── sidecars/
    └── actions-panel/          # Веб-панель Sidecar
        ├── sidecar.json        # Декларация sidecar
        ├── server.mjs          # Сервер Node.js
        ├── locales/            # Базовые переводы интерфейса панели
        │   ├── en.json         # Английский
        │   └── ru.json         # Русский
        └── public/             # Фронтенд панели
            ├── index.html
            ├── style.css
            └── app.js
```

---

## Лицензия

Проект распространяется под лицензией [MIT](LICENSE).
