let prompts = {
  commit: "Сделай git status, сформируй осмысленное сообщение по Conventional Commits и сделай коммит.",
  codereview: "Проведи глубокий Code Review текущих изменений и незакоммиченных файлов: логика, безопасность, потенциальные баги, граничные случаи и читаемость.",
  test: "Запусти тесты проекта, проанализируй результаты выполнения и предложи исправления при ошибках.",
  deploy: "Выполни деплой проекта: проверь статус ветки, линтеры, тесты и запусти сценарий развертывания.",
  release: "Подготовь релиз: определи следующую SemVer-версию, обнови changelog и создай git-тег."
};

const consoleEl = document.getElementById("consoleOutput");
const gitBranchEl = document.getElementById("gitBranch");
const gitChangesEl = document.getElementById("gitChanges");
const gitLastCommitEl = document.getElementById("gitLastCommit");
const toastEl = document.getElementById("toast");

function logToConsole(text, isError = false) {
  const time = new Date().toLocaleTimeString();
  const prefix = isError ? "❌ " : "👉 ";
  consoleEl.textContent = `[${time}] ${prefix}${text}\n\n` + consoleEl.textContent;
}

function clearConsole() {
  consoleEl.textContent = "Консоль очищена.";
}

function showToast(message = "Скопировано в буфер!") {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2000);
}

async function copyPrompt(action) {
  let promptText = prompts[action] || "";
  if (action === "commit") {
    const customMsg = document.getElementById("commitMsgInput").value.trim();
    if (customMsg) {
      promptText = `Сделай git commit с сообщением "${customMsg}". Перед коммитом проверь staged/unstaged файлы.`;
    }
  }

  try {
    await navigator.clipboard.writeText(promptText);
    showToast("Промпт скопирован! Вставьте в чат Antigravity.");
    logToConsole(`Промпт для [${action}] скопирован:\n"${promptText}"`);
  } catch (err) {
    // Fallback if clipboard API blocked
    const textarea = document.createElement("textarea");
    textarea.value = promptText;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    showToast("Промпт скопирован!");
    logToConsole(`Промпт скопирован в буфер: "${promptText}"`);
  }
}

async function fetchStatus() {
  try {
    const res = await fetch("/api/status");
    if (!res.ok) throw new Error("Status endpoint error");
    const data = await res.json();

    if (data.ok) {
      gitBranchEl.textContent = data.branch;
      gitChangesEl.textContent = `${data.totalChanges} (Staged: ${data.stagedCount}, Mod: ${data.modifiedCount})`;
      gitLastCommitEl.textContent = data.lastCommit;
    } else {
      gitBranchEl.textContent = "Не Git";
      gitChangesEl.textContent = "0";
      gitLastCommitEl.textContent = data.error || "Не в Git репозитории";
    }
  } catch (err) {
    gitBranchEl.textContent = "Ошибка";
    gitChangesEl.textContent = "-";
    gitLastCommitEl.textContent = "Не удалось подключиться к серверу";
  }
}

async function triggerAction(action) {
  logToConsole(`Запуск действия [${action}]...`);

  let options = {};
  if (action === "commit") {
    options.message = document.getElementById("commitMsgInput").value.trim();
  }

  try {
    const res = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, options })
    });

    const data = await res.json();
    if (data.ok) {
      const output = data.output || data.note || "Успешно выполнено.";
      logToConsole(`[${action}] Результат:\n${output}`);
      fetchStatus();
    } else {
      logToConsole(`[${action}] Ошибка:\n${data.error || data.output || "Неизвестная ошибка"}`, true);
    }
  } catch (err) {
    logToConsole(`Ошибка сетевого запроса к сайдкару: ${err.message}`, true);
  }
}

document.getElementById("refreshBtn").addEventListener("click", () => {
  fetchStatus();
  showToast("Статус обновлен");
});

// Initial load
fetchStatus();
fetch("/api/prompts")
  .then(r => r.json())
  .then(d => { if (d.prompts) prompts = d.prompts; })
  .catch(() => {});
