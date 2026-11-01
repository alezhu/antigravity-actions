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
      const cmd = msg ? `/commit ${msg}` : "/commit";
      const title = msg ? `⚡ /commit: "${msg}"` : "⚡ /commit";
      return { cmd, title, label: "/commit" };
    }
    case "codereview": {
      const target = document.getElementById("reviewInput").value.trim();
      const cmd = target ? `/code-review ${target}` : "/code-review";
      const title = target ? `⚡ /code-review: ${target}` : "⚡ /code-review";
      return { cmd, title, label: "/code-review" };
    }
    case "test": {
      const filter = document.getElementById("testInput").value.trim();
      const cmd = filter ? `/run-tests ${filter}` : "/run-tests";
      const title = filter ? `⚡ /run-tests: ${filter}` : "⚡ /run-tests";
      return { cmd, title, label: "/run-tests" };
    }
    case "deploy": {
      const env = document.getElementById("deployInput").value.trim();
      const cmd = env ? `/deploy --env=${env}` : "/deploy";
      const title = env ? `⚡ /deploy: ${env}` : "⚡ /deploy";
      return { cmd, title, label: "/deploy" };
    }
    case "release": {
      const ver = document.getElementById("releaseInput").value.trim();
      const cmd = ver ? `/release ${ver}` : "/release";
      const title = ver ? `⚡ /release: ${ver}` : "⚡ /release";
      return { cmd, title, label: "/release" };
    }
    default:
      return { cmd: "", title: "", label: "" };
  }
}

function startRunningIndicator(action, meta) {
  currentRunningAction = action;
  activeStartTime = Date.now();

  // Reset classes
  activeCardEl.classList.remove("hidden", "success");
  activeBadgeEl.textContent = "⚡ ВЫПОЛНЯЕТСЯ В ЧАТЕ";
  activeTitleEl.textContent = meta.title;
  activeTimerEl.textContent = "0с";

  // Highlight specific card
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

function stopRunningIndicator(success = true, message = "") {
  clearInterval(activeTimerInterval);
  clearInterval(activePollInterval);

  const elapsed = Math.round((Date.now() - activeStartTime) / 1000);

  if (success && currentRunningAction) {
    activeCardEl.classList.add("success");
    activeBadgeEl.textContent = "✅ ЗАВЕРШЕНО";
    activeTitleEl.textContent = message || `${activeTitleEl.textContent} (${elapsed}с)`;
    activeTimerEl.textContent = `${elapsed}с`;

    setTimeout(() => {
      activeCardEl.classList.add("hidden");
      activeCardEl.classList.remove("success");
    }, 4500);
  } else {
    activeCardEl.classList.add("hidden");
  }

  // Clear card highlight
  document.querySelectorAll(".action-card").forEach(c => c.classList.remove("running"));
  currentRunningAction = null;
}

function monitorExecution(action, meta, btn, origText) {
  let sawRunningState = false;
  let checkCount = 0;

  activePollInterval = setInterval(async () => {
    checkCount++;
    try {
      const convId = getActiveConversationId() || "";
      const res = await fetch(`/api/status?conversationId=${encodeURIComponent(convId)}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.isRunning) {
        sawRunningState = true;
      } else if (sawRunningState && !data.isRunning) {
        // Was running and now completed!
        const elapsed = Math.round((Date.now() - activeStartTime) / 1000);
        logToConsole(`✅ [ЗАВЕРШЕНО]: ${meta.title} успешно завершена агентом за ${elapsed}с!`);
        showToast(`✅ ${meta.label} завершено!`);
        stopRunningIndicator(true, `✅ ${meta.title} выполнена за ${elapsed}с`);

        if (btn) {
          btn.disabled = false;
          btn.textContent = origText;
        }
      }
    } catch {}

    // Safety timeout after 180 seconds
    if (checkCount > 180) {
      stopRunningIndicator(true, `Команда передана: ${meta.title}`);
      if (btn) {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }
  }, 1000);
}

async function handleAction(action, immediate = true, btnElement = null) {
  const meta = getActionMeta(action);
  if (!meta.cmd) return;

  const btn = btnElement || document.getElementById(`btn-run-${action}`) || (window.event ? window.event.currentTarget : null);
  const origText = btn ? (btn.getAttribute("data-orig") || btn.textContent) : "⚡ Выполнить (Enter)";
  if (btn && !btn.getAttribute("data-orig")) {
    btn.setAttribute("data-orig", origText);
  }

  if (immediate) {
    // ⚡ Выполнить сразу в чате (Enter)
    if (btn) {
      btn.disabled = true;
      btn.textContent = `⏳ Выполняется ${meta.label}...`;
    }

    startRunningIndicator(action, meta);
    logToConsole(`⚡ [ЗАПУСК КОМАНДЫ]: ${meta.cmd}\n⏳ Команда передана в чат агенту. Выполнение начато...`);

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
        logToConsole(`✅ Команда ${meta.label} отправлена в чат! Агент выполняет инструкции.`);
        showToast(`⚡ Выполняется: ${meta.label}`);
        monitorExecution(action, meta, btn, origText);
      } else {
        throw new Error(data.error || "Неизвестная ошибка сервера");
      }
    } catch (err) {
      logToConsole(`Ошибка отправки: ${err.message}. Копируем команду в буфер...`, true);
      stopRunningIndicator(false);
      await copyToClipboard(meta.cmd);
      showToast("Скопировано в буфер (нажмите Ctrl+V)", true);
      if (btn) {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }
  } else {
    // 📥 Заполнить окно ввода (без Enter)
    logToConsole(`📥 [ПОДГОТОВЛЕНО ДЛЯ ЧАТА]: "${meta.cmd}"\n📋 Скопировано в буфер обмена. Вставьте в чат Antigravity через Ctrl+V без немедленного выполнения.`);
    await copyToClipboard(meta.cmd);
    showToast(`📋 Скопировано: ${meta.label}. Нажмите Ctrl+V в чате!`);
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
