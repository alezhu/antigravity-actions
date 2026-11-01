let prompts = {
  commit: "Сделай git status, проанализируй git diff, сформируй осмысленное сообщение по Conventional Commits и сделай коммит.",
  codereview: "Проведи глубокий Code Review текущих изменений и незакоммиченных файлов: логика, безопасность, потенциальные баги, граничные случаи и качество кода.",
  test: "Запусти тесты проекта, проанализируй результаты выполнения и предложи исправления при ошибках.",
  deploy: "Выполни процедуру деплоя проекта: проверь статус ветки, линтеры, тесты, сборку и запусти сценарий развертывания.",
  release: "Подготовь релиз проекта: определи следующую SemVer-версию, обнови changelog и создай git-тег."
};

let currentWorkspace = localStorage.getItem("antigravity_workspace_path") || "D:\\Projects\\Web\\Front\\antigravity-actions";

const consoleEl = document.getElementById("consoleOutput");
const gitBranchEl = document.getElementById("gitBranch");
const gitChangesEl = document.getElementById("gitChanges");
const gitLastCommitEl = document.getElementById("gitLastCommit");
const toastEl = document.getElementById("toast");
const workspaceInput = document.getElementById("workspaceInput");

function logToConsole(text, isError = false) {
  const time = new Date().toLocaleTimeString();
  const prefix = isError ? "❌ " : "👉 ";
  consoleEl.textContent = `[${time}] ${prefix}${text}\n\n` + consoleEl.textContent;
}

function clearConsole() {
  consoleEl.textContent = "Консоль очищена.";
}

function showToast(message = "Выполнено!", isError = false) {
  toastEl.textContent = message;
  toastEl.style.backgroundColor = isError ? "#ef4444" : "#10b981";
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2500);
}

function uriToPath(uri) {
  if (!uri) return "";
  let clean = uri;
  if (clean.startsWith("file:///")) {
    clean = decodeURIComponent(clean.replace("file:///", ""));
    if (/^[a-zA-Z]:/.test(clean)) {
      clean = clean.replace(/\//g, "\\");
    }
  }
  return clean;
}

function getPromptForAction(action) {
  let promptText = prompts[action] || "";
  if (action === "commit") {
    const customMsg = document.getElementById("commitMsgInput").value.trim();
    if (customMsg) {
      promptText = `Сделай git commit с сообщением "${customMsg}". Перед коммитом проверь staged/unstaged файлы.`;
    }
  }
  return promptText;
}

// Отправка промпта прямо в чат Antigravity
async function sendPromptToChat(action) {
  const promptText = getPromptForAction(action);
  logToConsole(`Отправка задачи агенту в чат: "${promptText}"...`);

  // 1. Попытка через backend API (/api/send-chat)
  try {
    const res = await fetch("/api/send-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: promptText,
        conversationId: window.sidecar?.conversationId
      })
    });
    const data = await res.json();
    if (data.ok) {
      showToast("🚀 Задача отправлена в чат Antigravity!");
      logToConsole("✅ Сообщение доставлено агенту! Он приступает к выполнению в чате.");
      return;
    }
  } catch (err) {
    console.warn("Backend send-chat failed, trying preload bridge...", err);
  }

  // 2. Попытка через window.sidecar SDK bridge
  if (window.sidecar && window.sidecar.agent) {
    try {
      if (window.sidecar.conversationId) {
        await window.sidecar.agent.sendMessage(promptText);
        showToast("🚀 Отправлено в чат Antigravity!");
        logToConsole("✅ Отправлено в текущий диалог через Sidecar SDK.");
        return;
      } else {
        await window.sidecar.agent.startConversation(promptText);
        showToast("🚀 Открыт новый диалог с задачей!");
        logToConsole("✅ Открыт новый диалог с задачей через Sidecar SDK.");
        return;
      }
    } catch (err) {
      console.warn("window.sidecar.agent failed:", err);
    }
  }

  // 3. Fallback (если запущено отдельно в браузере)
  try {
    await navigator.clipboard.writeText(promptText);
    showToast("📋 Скопировано в буфер (панель открыта вне Antigravity)");
    logToConsole("⚠️ Панель запущена вне среды Antigravity, промпт скопирован в буфер обмена.");
  } catch (e) {
    showToast("Не удалось отправить", true);
  }
}

async function fetchStatus() {
  try {
    const res = await fetch(`/api/status?workspacePath=${encodeURIComponent(currentWorkspace)}`);
    if (!res.ok) throw new Error("Status endpoint error");
    const data = await res.json();

    if (data.ok) {
      gitBranchEl.textContent = data.branch;
      gitChangesEl.textContent = `${data.totalChanges} (Staged: ${data.stagedCount}, Mod: ${data.modifiedCount})`;
      gitLastCommitEl.textContent = data.lastCommit;
      if (data.cwd) {
        currentWorkspace = data.cwd;
        workspaceInput.value = data.cwd;
      }
    } else {
      gitBranchEl.textContent = "Не Git";
      gitChangesEl.textContent = "0";
      gitLastCommitEl.textContent = data.error || "Не в Git репозитории";
    }
  } catch (err) {
    gitBranchEl.textContent = "Ошибка";
    gitChangesEl.textContent = "-";
    gitLastCommitEl.textContent = "Сайдкар недоступен: " + err.message;
  }
}

async function triggerAction(action) {
  logToConsole(`Запуск действия [${action}] в "${currentWorkspace}"...`);

  let options = {};
  if (action === "commit") {
    options.message = document.getElementById("commitMsgInput").value.trim();
  }

  try {
    const res = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        options,
        workspacePath: currentWorkspace
      })
    });

    const data = await res.json();
    if (data.ok) {
      const output = data.output || "Успешно выполнено.";
      logToConsole(`[${action}] РЕЗУЛЬТАТ:\n${output}`);
      showToast("Действие выполнено успешно!");
      if (action === "commit") {
        document.getElementById("commitMsgInput").value = "";
      }
      fetchStatus();
    } else {
      logToConsole(`[${action}] Ошибка:\n${data.error || data.output || "Неизвестная ошибка"}`, true);
      showToast(data.error || "Ошибка выполнения", true);
    }
  } catch (err) {
    logToConsole(`Ошибка сетевого запроса к сайдкару: ${err.message}`, true);
    showToast("Сетевая ошибка", true);
  }
}

// Применение пути проекта
document.getElementById("setWorkspaceBtn").addEventListener("click", () => {
  const val = workspaceInput.value.trim();
  if (val) {
    currentWorkspace = val;
    localStorage.setItem("antigravity_workspace_path", val);
    fetchStatus();
    showToast("Путь к проекту обновлен");
    logToConsole(`Рабочий проект переключен на: ${val}`);
  }
});

workspaceInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    document.getElementById("setWorkspaceBtn").click();
  }
});

document.getElementById("refreshBtn").addEventListener("click", () => {
  fetchStatus();
  showToast("Статус обновлен");
});

// Инициализация workspace из Antigravity SDK
async function init() {
  workspaceInput.value = currentWorkspace;

  if (window.sidecar && window.sidecar.getWorkspaceUris) {
    try {
      const uris = await window.sidecar.getWorkspaceUris();
      if (uris && uris.length > 0) {
        const path = uriToPath(uris[0]);
        if (path) {
          currentWorkspace = path;
          workspaceInput.value = path;
        }
      }
      window.sidecar.onWorkspaceChange((newUris) => {
        if (newUris && newUris.length > 0) {
          const path = uriToPath(newUris[0]);
          if (path) {
            currentWorkspace = path;
            workspaceInput.value = path;
            fetchStatus();
            logToConsole(`Antigravity переключил проект на: ${path}`);
          }
        }
      });
    } catch (e) {
      console.warn("Could not query workspace URIs from sidecar:", e);
    }
  }

  fetchStatus();

  fetch("/api/prompts")
    .then(r => r.json())
    .then(d => { if (d.prompts) prompts = d.prompts; })
    .catch(() => {});
}

init();
