# Навык: Подготовка и выпуск релиза (Release)

Когда вызывается этот навык, **в первую очередь (первой строкой ответа)** выведи:
`### ⚡ Executing command: /release`

## Инструкции

1. **Определение следующей версии**:
   - Получи последний тег через `git describe --tags --abbrev=0`.
   - Проанализируй коммиты с момента последнего тега по правилам SemVer (Semantic Versioning):
     - `BREAKING CHANGE` -> Major bump.
     - `feat:` -> Minor bump.
     - `fix:` / `refactor:` / `chore:` -> Patch bump.
   - Если пользователь передал тип бампа (`patch`, `minor`, `major` или конкретную версию `v1.2.0`), используй его.

2. **Обновление версий и Changelog**:
   - Обнови версию в `package.json`, `plugin.json` (и других манифестах проекта).
   - Сформируй новую секцию в `CHANGELOG.md` в формате [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) со стандартными категориями изменений (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`).

3. **Создание Git-тега**:
   - Создай аннотированный тег: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
   - Ответ формируй на русском языке (или языке, запрошенном пользователем).
