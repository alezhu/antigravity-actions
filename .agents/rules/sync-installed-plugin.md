# Sync to Installed Antigravity Plugin

При любых изменениях в репозитории `antigravity-actions` всегда синхронизировать файлы в установленный глобальный плагин Antigravity:
`C:\Users\alezhur\.gemini\config\plugins\antigravity-actions`

Команда синхронизации:
```powershell
robocopy "D:\Projects\Web\Front\antigravity-actions" "$env:USERPROFILE\.gemini\config\plugins\antigravity-actions" /MIR /XD .git
```
