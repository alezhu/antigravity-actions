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

function getActionMeta(action) {
  switch (action) {
    case "commit": {
      const msg = document.getElementById("commitInput").value.trim();
      const cmd = msg ? `/commit "${msg}"` : "/commit";
      const title = msg ? `⚡ Commit: "${msg}"` : "⚡ /commit";
      return { cmd, title, label: "/commit" };
    }
    case "codereview": {
      const target = document.getElementById("reviewInput").value.trim();
      const cmd = target ? `/code-review ${target}` : "/code-review";
      const title = target ? `⚡ Code Review: ${target}` : "⚡ /code-review";
      return { cmd, title, label: "/code-review" };
    }
    case "test": {
      const filter = document.getElementById("testInput").value.trim();
      const cmd = filter ? `/run-tests ${filter}` : "/run-tests";
      const title = filter ? `⚡ Tests: ${filter}` : "⚡ /run-tests";
      return { cmd, title, label: "/run-tests" };
    }
    case "deploy": {
      const env = document.getElementById("deployInput").value.trim();
      const cmd = env ? `/deploy ${env}` : "/deploy";
      const title = env ? `⚡ Deploy: ${env}` : "⚡ /deploy";
      return { cmd, title, label: "/deploy" };
    }
    case "release": {
      const ver = document.getElementById("releaseInput").value.trim();
      const cmd = ver ? `/release ${ver}` : "/release";
      const title = ver ? `⚡ Release: ${ver}` : "⚡ /release";
      return { cmd, title, label: "/release" };
    }
    default:
      return { cmd: "", title: "", label: "" };
  }
}

function startRunningIndicator(action, meta, btn) {
  currentRunningAction = action;
  activeStartTime = Date.now();

  // Reset classes
  activeCardEl.classList.remove("hidden", "success", "error");
  activeBadgeEl.textContent = "⚡ ВЫПОЛНЯЕТСЯ В ЧАТЕ";
  activeTitleEl.textContent = meta.title;
  activeTimerEl.textContent = "0с";

  // Highlight specific action card
  document.querySelectorAll(".action-card").forEach(c => c.classList.remove("running"));
  const card = document.getElementById(`card-${action}`);
  if (card) card.classList.add("running");

  // Visual indication on button
  if (btn) {
    if (!btn.getAttribute("data-orig")) {
      btn.setAttribute("data-orig", btn.textContent);
    }
    btn.textContent = `⏳ ${meta.label}...`;
  }

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

  // Restore button text for all buttons
  document.querySelectorAll(".btn-primary").forEach(btn => {
    const orig = btn.getAttribute("data-orig");
    if (orig) btn.textContent = orig;
  });

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
    activeTitleEl.textContent = message || "Команда завершилась с ошибкой";
    activeTimerEl.textContent = `${elapsed}с`;

    setTimeout(() => {
      activeCardEl.classList.add("hidden");
      activeCardEl.classList.remove("error");
    }, 5000);
  } else {
    activeCardEl.classList.add("hidden");
    activeCardEl.classList.remove("success", "error");
  }

  currentRunningAction = null;
}

function monitorExecution(action, meta) {
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
        logToConsole(`❌ [ОШИБКА]: Агент завершил выполнение с ошибкой.`, true);
        showToast(`❌ Ошибка выполнения ${meta.label}`, true);
        stopRunningIndicator("error", `Ошибка: ${meta.title}`);
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

      // 4. Safety timeout after 180 seconds
      if (checkCount > 180) {
        stopRunningIndicator("success", `Команда отправлена: ${meta.title}`);
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
    startRunningIndicator(action, meta, btn);
    logToConsole(`⚡ [ОТПРАВКА]: ${meta.cmd}\n⏳ Отправка в активный диалог Antigravity...`);

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
        logToConsole(`✅ Команда ${meta.cmd} доставлена в чат!`);
        showToast(`⚡ Выполняется: ${meta.label}`);
        monitorExecution(action, meta);
      } else {
        logToConsole(`❌ [ОШИБКА ОТПРАВКИ]: ${data.error}`, true);
        showToast(`❌ Ошибка отправки`, true);
        stopRunningIndicator("error", data.error || "Ошибка отправки");
      }
    } catch (err) {
      logToConsole(`❌ [ОШИБКА]: ${err.message}. Копируем команду в буфер...`, true);
      stopRunningIndicator("error", "Сбой соединения");
      await copyToClipboard(meta.cmd);
      showToast("Скопировано в буфер (нажмите Ctrl+V)", true);
    }
  } else {
    // 📥 Заполнить окно ввода (без Enter)
    logToConsole(`📥 [ПОДГОТОВЛЕНО]: "${meta.cmd}"\n📋 Скопировано в буфер. Вставьте в поле чата Antigravity через Ctrl+V.`);
    await copyToClipboard(meta.cmd);
    showToast(`📋 Скопировано: ${meta.cmd}. Нажмите Ctrl+V в чате!`);
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
