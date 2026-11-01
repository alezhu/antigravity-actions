const consoleEl = document.getElementById("consoleOutput");
const toastEl = document.getElementById("toast");

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
  }, 3000);
}

function buildPrompt(action) {
  switch (action) {
    case "commit": {
      const msg = document.getElementById("commitInput").value.trim();
      return msg 
        ? `Сделай git commit с сообщением "${msg}". Проверь статус и diff перед коммитом.`
        : "/commit";
    }
    case "codereview": {
      const target = document.getElementById("reviewInput").value.trim();
      return target 
        ? `/code-review ${target}`
        : "/code-review";
    }
    case "test": {
      const filter = document.getElementById("testInput").value.trim();
      return filter 
        ? `/run-tests ${filter}`
        : "/run-tests";
    }
    case "deploy": {
      const env = document.getElementById("deployInput").value.trim();
      return env 
        ? `/deploy --env=${env}`
        : "/deploy";
    }
    case "release": {
      const ver = document.getElementById("releaseInput").value.trim();
      return ver 
        ? `/release ${ver}`
        : "/release";
    }
    default:
      return "";
  }
}

async function handleAction(action, immediate = true) {
  const commandText = buildPrompt(action);
  if (!commandText) return;

  if (immediate) {
    // ⚡ Выполнить сразу (как с Enter): отправляем команду напрямую в чат через Connect RPC
    logToConsole(`⚡ Отправка команды в чат [с Enter]: "${commandText}"...`);
    try {
      const convId = window.sidecar?.conversationId || null;
      const res = await fetch("/api/send-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: commandText,
          conversationId: convId
        })
      });

      const data = await res.json();
      if (data.ok) {
        logToConsole(`✅ Команда "${commandText}" успешно передана агенту в активный чат! Агент начинает выполнение.`);
        showToast("🚀 Отправлено в чат! Агент выполняет...");
      } else {
        throw new Error(data.error || "Неизвестная ошибка сервера");
      }
    } catch (err) {
      logToConsole(`Ошибка прямой отправки: ${err.message}. Копируем команду в буфер обмена...`, true);
      await copyToClipboard(commandText);
      showToast("Скопировано в буфер (нажмите Ctrl+V в чате)", true);
    }
  } else {
    // 📥 Заполнить окно ввода (без Enter): копируем в буфер для быстрой вставки по Ctrl+V
    logToConsole(`📥 Подготовка команды [без Enter]: "${commandText}"...`);
    await copyToClipboard(commandText);
    logToConsole(`✅ Команда "${commandText}" скопирована в буфер. Нажмите Ctrl+V в поле ввода сообщения внизу окна Antigravity.`);
    showToast(`📋 Скопировано: ${commandText}. Нажмите Ctrl+V в поле чата!`);
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}
