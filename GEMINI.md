# Antigravity Actions — Project Rules & Guidelines

## Правило синхронизации с установленным плагином Antigravity (Plugin Sync Rule)

КРИТИЧЕСКОЕ ПРАВИЛО:
При **любых** изменениях в этом репозитории (`D:\Projects\Web\Front\antigravity-actions`):
добавлении/удалении навыков, правках кода веб-панели sidecar, изменении локализаций или манифестов — агент **ОБЯЗАН ВСЕГДА** автоматически синхронизировать изменения в рабочую папку установленного плагина Antigravity:

* **Целевой каталог**: `C:\Users\alezhur\.gemini\config\plugins\antigravity-actions` (`$env:USERPROFILE\.gemini\config\plugins\antigravity-actions`)

### Порядок синхронизации:
1. Выполнить зеркальное копирование изменений (исключая `.git`):
   ```powershell
   robocopy "D:\Projects\Web\Front\antigravity-actions" "$env:USERPROFILE\.gemini\config\plugins\antigravity-actions" /MIR /XD .git
   ```
   *(Коды выхода robocopy от 0 до 3 означают успешное копирование/удаление)*.
2. Убедиться, что удаленные файлы (например, устаревшие навыки) удалены и из целевой папки, а новые добавлены.
3. При необходимости обновить/проверить состояние плагина через RPC вызов `GetAllPlugins` Language Server'а Antigravity (`$env:ANTIGRAVITY_LS_ADDRESS`), чтобы изменения применились на лету.
