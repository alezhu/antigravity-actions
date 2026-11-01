const consoleEl = document.getElementById("consoleOutput");
const toastEl = document.getElementById("toast");
const activeCardEl = document.getElementById("activeCommandCard");
const activeBadgeEl = document.getElementById("activeCommandBadge");
const activeTitleEl = document.getElementById("activeCommandTitle");
const activeTimerEl = document.getElementById("activeCommandTimer");

let activeTimerInterval = null;
let activePollInterval = null;
let activeStartTime = 0;
let currentRunningAction = null;

function getActiveConversationId() {
  const params = new URLSearchParams(window.location.search);
  return window.sidecar?.conversationId || params.get("conversationId") || null;
}

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

function setAllRunButtonsDisabled(disabled) {
  document.querySelectorAll(".btn-primary").forEach(btn => {
    btn.disabled = disabled;
    if (disabled) {
      if (!btn.getAttribute("data-orig")) {
        btn.setAttribute("data-orig", btn.textContent);
      }
    } else {
      const orig = btn.getAttribute("data-orig");
      if (orig) btn.textContent = orig;
    }
  });
}

function getActionMeta(action) {
  switch (action) {
    case "commit": {
      const msg = document.getElementById("commitInput").value.trim();
      const cmd = msg ? `⚡ Выполни /commit: "${msg}"` : "⚡ Выполни /commit";
      const clipboardCmd = msg ? `/commit ${msg}` : "/commit";
      const title = msg ? `⚡ /commit: "${msg}"` : "⚡ /commit";
      return { cmd, clipboardCmd, title, label: "/commit" };
    }
    case "codereview": {
      const target = document.getElementById("reviewInput").value.trim();
      const cmd = target ? `⚡ Выполни /code-review для: ${target}` : "⚡ Выполни /code-review";
      const clipboardCmd = target ? `/code-review ${target}` : "/code-review";
      const title = target ? `⚡ /code-review: ${target}` : "⚡ /code-review";
      return { cmd, clipboardCmd, title, label: "/code-review" };
    }
    case "test": {
      const filter = document.getElementById("testInput").value.trim();
      const cmd = filter ? `⚡ Выполни /run-tests: ${filter}` : "⚡ Выполни /run-tests";
      const clipboardCmd = filter ? `/run-tests ${filter}` : "/run-tests";
      const title = filter ? `⚡ /run-tests: ${filter}` : "⚡ /run-tests";
      return { cmd, clipboardCmd, title, label: "/run-tests" };
    }
    case "deploy": {
      const env = document.getElementById("deployInput").value.trim();
      const cmd = env ? `⚡ Выполни /deploy --env=${env}` : "⚡ Выполни /deploy";
      const clipboardCmd = env ? `/deploy --env=${env}` : "/deploy";
      const title = env ? `⚡ /deploy: ${env}` : "⚡ /deploy";
      return { cmd, clipboardCmd, title, label: "/deploy" };
    }
    case "release": {
      const ver = document.getElementById("releaseInput").value.trim();
      const cmd = ver ? `⚡ Выполни /release ${ver}` : "⚡ Выполни /release";
      const clipboardCmd = ver ? `/release ${ver}` : "/release";
      const title = ver ? `⚡ /release: ${ver}` : "⚡ /release";
      return { cmd, clipboardCmd, title, label: "/release" };
    }
    default:
      return { cmd: "", clipboardCmd: "", title: "", label: "" };
  }
}

function startRunningIndicator(action, meta) {
  currentRunningAction = action;
  activeStartTime = Date.now();

  setAllRunButtonsDisabled(true);

  // Reset classes
  activeCardEl.classList.remove("hidden", "success", "error");
  activeBadgeEl.textContent = "⚡ ВЫПОЛНЯЕТСЯ В ЧАТЕ";
  activeTitleEl.textContent = meta.title;
  activeTimerEl.textContent = "0с";

  // Highlight specific action card
  document.querySelectorAll(".action-card").forEach(c => c.classList.remove("running"));
  const card = document.getElementById(`card-${action}`);
  if (card) card.classList.add("running");

  // Timer interval
  clearInterval(activeTimerInterval);
  activeTimerInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - activeStartTime) / 1000);
    activeTimerEl.textContent = `${elapsed}с`;
  }, 1000);
}

function stopRunningIndicator(state = "success", message = "") {
  clearInterval(activeTimerInterval);
  clearInterval(activePollInterval);

  const elapsed = Math.round((Date.now() - activeStartTime) / 1000);
  setAllRunButtonsDisabled(false);

  // Clear card highlight
  document.querySelectorAll(".action-card").forEach(c => c.classList.remove("running"));

  if (state === "success") {
    activeCardEl.classList.remove("error");
    activeCardEl.classList.add("success");
    activeBadgeEl.textContent = "✅ ЗАВЕРШЕНО";
    activeTitleEl.textContent = message || `${activeTitleEl.textContent} (${elapsed}с)`;
    activeTimerEl.textContent = `${elapsed}с`;

    setTimeout(() => {
      activeCardEl.classList.add("hidden");
      activeCardEl.classList.remove("success");
    }, 4500);
  } else if (state === "error") {
    activeCardEl.classList.remove("success");
    activeCardEl.classList.add("error");
    activeBadgeEl.textContent = "❌ ОШИБКА";
    activeTitleEl.textContent = message || "Команда остановлена из-за ошибки";
    activeTimerEl.textContent = `${elapsed}с`;

    setTimeout(() => {
      activeCardEl.classList.add("hidden");
      activeCardEl.classList.remove("error");
    }, 6000);
  } else {
    activeCardEl.classList.add("hidden");
    activeCardEl.classList.remove("success", "error");
  }

  currentRunningAction = null;
}

function monitorExecution(action, meta, btn) {
  let sawRunningState = false;
  let checkCount = 0;
  let initialStepCount = null;

  activePollInterval = setInterval(async () => {
    checkCount++;
    try {
      const convId = getActiveConversationId() || "";
      const res = await fetch(`/api/status?conversationId=${encodeURIComponent(convId)}`);
      if (!res.ok) return;
      const data = await res.json();

      if (initialStepCount === null && typeof data.stepCount === "number") {
        initialStepCount = data.stepCount;
      }

      // 1. Detect explicit error
      if (data.isError) {
        logToConsole(`❌ [ОШИБКА]: Агент завершил выполнение с ошибкой (Execution error).`, true);
        showToast(`❌ Ошибка выполнения ${meta.label}`, true);
        stopRunningIndicator("error", `Ошибка выполнения: ${meta.title}`);
        return;
      }

      // 2. Detect cancellation
      if (data.isCanceled) {
        logToConsole(`⚠️ [ПРЕРВАНО]: Выполнение команды ${meta.label} было отменено.`, true);
        showToast(`⚠️ Выполнение ${meta.label} отменено`, true);
        stopRunningIndicator("error", `Прервано: ${meta.title}`);
        return;
      }

      // 3. Track running state
      if (data.isRunning) {
        sawRunningState = true;
      } else if (!data.isRunning && (sawRunningState || (initialStepCount !== null && data.stepCount > initialStepCount))) {
        // Was running and now completed!
        const elapsed = Math.round((Date.now() - activeStartTime) / 1000);
        logToConsole(`✅ [ЗАВЕРШЕНО]: ${meta.title} успешно выполнена за ${elapsed}с!`);
        showToast(`✅ ${meta.label} выполнено!`);
        stopRunningIndicator("success", `✅ ${meta.title} выполнена за ${elapsed}с`);
        return;
      }

      // 4. Quick termination or timeout check
      if (checkCount > 5 && !data.isRunning && !sawRunningState && initialStepCount !== null && data.stepCount === initialStepCount) {
        // Command was never started or stopped immediately without steps
        logToConsole(`⚠️ [НЕ ЗАПУЩЕНО]: Статус выполнения не изменился.`, true);
        stopRunningIndicator("error", `Команда не была начата`);
        return;
      }

      // 5. Safety timeout after 180 seconds
      if (checkCount > 180) {
        stopRunningIndicator("success", `Команда передана: ${meta.title}`);
        return;
      }
    } catch (err) {
      console.warn("Polling error:", err);
    }
  }, 1000);
}

async function handleAction(action, immediate = true, btnElement = null) {
  const meta = getActionMeta(action);
  if (!meta.cmd) return;

  const btn = btnElement || document.getElementById(`btn-run-${action}`) || (window.event ? window.event.currentTarget : null);

  if (immediate) {
    // ⚡ Выполнить сразу в чате (Enter)
    if (currentRunningAction) {
      showToast("⏳ Уже выполняется другая команда. Пожалуйста, подождите.", true);
      return;
    }

    startRunningIndicator(action, meta);
    if (btn) btn.textContent = `⏳ Выполняется ${meta.label}...`;

    logToConsole(`⚡ [ЗАПУСК КОМАНДЫ]: ${meta.cmd}\n⏳ Отправка в активный диалог Antigravity...`);

    try {
      const convId = getActiveConversationId();
      const res = await fetch("/api/send-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: meta.cmd,
          displayTitle: meta.title,
          conversationId: convId
        })
      });

      const data = await res.json();
      if (data.ok) {
        logToConsole(`✅ Сообщение "${meta.cmd}" принято чатом! Ожидание ответа модели...`);
        showToast(`⚡ Выполняется: ${meta.label}`);
        monitorExecution(action, meta, btn);
      } else {
        if (data.busy) {
          logToConsole(`⚠️ [ЗАНЯТО]: ${data.error}`, true);
          showToast(`⚠️ Агент занят. Дождитесь завершения!`, true);
        } else {
          logToConsole(`❌ [ОШИБКА СЕРВЕРА]: ${data.error}`, true);
          showToast(`❌ Ошибка отправки команды`, true);
        }
        stopRunningIndicator("error", data.error || "Ошибка отправки");
      }
    } catch (err) {
      logToConsole(`❌ [ОШИБКА]: ${err.message}. Копируем команду в буфер...`, true);
      stopRunningIndicator("error", "Сбой соединения");
      await copyToClipboard(meta.clipboardCmd);
      showToast("Скопировано в буфер (нажмите Ctrl+V)", true);
    }
  } else {
    // 📥 Заполнить окно ввода (без Enter)
    logToConsole(`📥 [ПОДГОТОВЛЕНО ДЛЯ ЧАТА]: "${meta.clipboardCmd}"\n📋 Скопировано в буфер. Вставьте в поле чата Antigravity через Ctrl+V.`);
    await copyToClipboard(meta.clipboardCmd);
    showToast(`📋 Скопировано: ${meta.clipboardCmd}. Нажмите Ctrl+V в чате!`);
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
