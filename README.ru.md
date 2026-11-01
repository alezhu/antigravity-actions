# Antigravity Actions ⚡

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Antigravity](https://img.shields.io/badge/Antigravity-Plugin-purple.svg)](https://antigravity.google)

[English](README.md) | Русский

Плагин для Google Antigravity, добавляющий быстрые действия для разработчика в один клик: **Commit**, **Code Review**, **Run Tests**, **Deploy** и **Release**.

---

## Возможности

### 1. Интерактивная боковая панель (UI Sidecar)
* **Статус репозитория в реальном времени**: отображает текущую Git-ветку, счетчики измененных/индексированных файлов и последний коммит.
* **Действия в один клик**: запуск действий напрямую или копирование готовых AI-промптов в чат по одной кнопке.
* **Встроенная консоль**: просмотр вывода команд и логов прямо во вспомогательной панели (Auxiliary Pane).
* **Поддержка тем**: автоматическая адаптация под светлую и темную темы Antigravity.

### 2. Встроенные навыки и слэш-команды
* `/commit` — анализирует `git diff`, генерирует понятное сообщение по Conventional Commits и делает коммит.
* `/code-review` — проводит глубокое ревью изменений (логические ошибки, безопасность, граничные случаи и кодстайл).
* `/run-tests` — определяет тестовый фреймворк проекта, запускает тесты и диагностирует падения.
* `/deploy` — запускает pre-flight проверки (чистый репозиторий, пройденные тесты, успешная сборка) перед деплоем.
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
2. **Использовать слэш-команды**: введите `/` в строке ввода чата и выберите `/commit`, `/code-review`, `/run-tests`, `/deploy` или `/release`.
3. **Использовать кнопки в чате**: нажмите на любой из появившихся интерактивных чипов подсказок.

---

## Лицензия

Проект распространяется под лицензией [MIT](LICENSE).
