---
name: release
description: Подготовка и выпуск релиза. Определяет семантическую версию (SemVer), генерирует Changelog, обновляет файлы манифестов и создает Git-тег.
---

# Навык: Smart Release Management

Этот навык автоматизирует шаги подготовки и фиксации релиза по методологии Semantic Versioning.

## Инструкция по выполнению

1. **Анализ истории изменений**:
   - Найди последний тег: `git describe --tags --abbrev=0` (или `git tag -l`).
   - Получи список коммитов с момента последнего релиза: `git log <last-tag>..HEAD --oneline`.
   - Проанализируй коммиты по стандартам Conventional Commits:
     - `feat!:` или `BREAKING CHANGE:` -> увеличение **MAJOR** версии (`1.0.0` -> `2.0.0`).
     - `feat:` -> увеличение **MINOR** версии (`1.0.0` -> `1.1.0`).
     - `fix:` / `perf:` / `refactor:` -> увеличение **PATCH** версии (`1.0.0` -> `1.0.1`).

2. **Согласование версии**:
   - Предложи пользователю вычисленную следующую версию.

3. **Обновление файлов версий**:
   - Обнови версию в `package.json`, `Cargo.toml`, `pyproject.toml`, `VERSION` или аналогичном файле проекта.

4. **Генерация / Обновление CHANGELOG.md**:
   - Добавь секцию для новой версии с датой.
   - Сгруппируй изменения:
     - 🚀 Features
     - 🐛 Bug Fixes
     - ⚡ Performance Improvements
     - 📝 Documentation & Maintenance

5. **Создание коммита релиза и Git-тега**:
   - Закоммить изменения: `git commit -am "chore(release): vX.Y.Z"`.
   - Создай аннотированный тег: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
   - Напомни пользователю отправить релиз: `git push origin && git push origin --tags`.
