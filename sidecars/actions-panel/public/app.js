// Antigravity Actions Sidecar Frontend

const consoleEl = document.getElementById("consoleOutput");
const toastEl = document.getElementById("toast");
const activeCardEl = document.getElementById("activeCommandCard");
const activeBadgeEl = document.getElementById("activeCommandBadge");
const activeTitleEl = document.getElementById("activeCommandTitle");
const activeTimerEl = document.getElementById("activeCommandTimer");
const langSelectEl = document.getElementById("langSelect");

let activeTimerInterval = null;
let activePollInterval = null;
let activeStartTime = 0;
let currentRunningAction = null;

// i18n state
let availableLocales = [];
let fallbackTranslations = {}; // Always English (en.json)
let currentTranslations = {};  // Active locale translations
let currentLocale = "en";

// Retrieve the currently active Antigravity conversation ID
function getActiveConversationId() {
  const params = new URLSearchParams(window.location.search);
  return window.sidecar?.conversationId || params.get("conversationId") || null;
}

// Safely resolve nested translation keys with fallback to English
function t(path, vars = {}) {
  const getNested = (obj, p) => p.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
  
  let val = getNested(currentTranslations, path);
  if (val === undefined || val === null || val === "") {
    val = getNested(fallbackTranslations, path);
  }
  if (val === undefined || val === null) {
    return path;
  }

  // Replace variable tokens like {label}, {cmd}, {input}
  return String(val).replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : `{${key}}`));
}

// Apply translations to all DOM elements marked with data-i18n attributes
function applyTranslations() {
  document.documentElement.lang = currentLocale;

  // Text content
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });

  // Rich HTML content
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    el.innerHTML = t(key);
  });

  // Title / Tooltips
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    el.title = t(key);
  });

  // Input placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.placeholder = t(key);
  });

  if (langSelectEl) {
    langSelectEl.value = currentLocale;
  }
}

// Load a specific locale by code
async function loadLocale(code) {
  try {
    const res = await fetch(`/api/locales/${code}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`Failed to fetch locale '${code}':`, err);
  }
  return null;
}

// Switch active locale, store preference in localStorage and re-render UI
async function setLocale(code) {
  if (code !== "en") {
    const loaded = await loadLocale(code);
    currentTranslations = loaded || {};
  } else {
    currentTranslations = fallbackTranslations;
  }
  currentLocale = code;
  try {
    localStorage.setItem("antigravity_actions_lang", code);
  } catch {}
  applyTranslations();
}

// Initialize i18n system on startup
async function initI18n() {
  // 1. Always load English as base fallback
  fallbackTranslations = (await loadLocale("en")) || {};
  currentTranslations = fallbackTranslations;

  // 2. Discover available locales dynamically from server
  try {
    const res = await fetch("/api/locales");
    if (res.ok) {
      availableLocales = await res.json();
    }
  } catch (err) {
    console.warn("Failed to load locales list:", err);
  }

  if (!availableLocales || availableLocales.length === 0) {
    availableLocales = [
      { code: "en", name: "English" },
      { code: "ru", name: "Русский" }
    ];
  }

  // Populate language selector
  if (langSelectEl) {
    langSelectEl.innerHTML = "";
    availableLocales.forEach(loc => {
      const opt = document.createElement("option");
      opt.value = loc.code;
      opt.textContent = loc.name;
      langSelectEl.appendChild(opt);
    });

    langSelectEl.addEventListener("change", (e) => {
      setLocale(e.target.value);
    });
  }

  // 3. Determine user preference: localStorage > browser language > default "en"
  let preferred = "en";
  try {
    preferred = localStorage.getItem("antigravity_actions_lang") || "";
  } catch {}

  if (!preferred) {
    const navLang = (navigator.language || "").slice(0, 2).toLowerCase();
    if (availableLocales.some(l => l.code === navLang)) {
      preferred = navLang;
    } else {
      preferred = "en";
    }
  }

  if (preferred !== "en" && availableLocales.some(l => l.code === preferred)) {
    await setLocale(preferred);
  } else {
    await setLocale("en");
  }
}

// Logging to the embedded activity console
function logToConsole(text, isError = false) {
  const time = new Date().toLocaleTimeString();
  const prefix = isError ? "❌ " : "👉 ";
  consoleEl.textContent = `[${time}] ${prefix}${text}\n\n` + consoleEl.textContent;
}

// Clear activity console
function clearConsole() {
  consoleEl.textContent = t("ui.consoleCleared");
}

// Display transient toast notifications
function showToast(message = "Done!", isError = false) {
  toastEl.textContent = message;
  toastEl.style.backgroundColor = isError ? "#ef4444" : "#10b981";
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 3000);
}

// Build action command, prompt, title, and metadata taking active locale into account
function getActionMeta(action) {
  const actionConfig = currentTranslations.actions?.[action] || fallbackTranslations.actions?.[action] || {};
  const fallbackConfig = fallbackTranslations.actions?.[action] || {};

  let input = "";
  switch (action) {
    case "commit":
      input = document.getElementById("commitInput")?.value.trim() || "";
      break;
    case "codereview":
      input = document.getElementById("reviewInput")?.value.trim() || "";
      break;
    case "test":
      input = document.getElementById("testInput")?.value.trim() || "";
      break;
    case "deploy":
      input = document.getElementById("deployInput")?.value.trim() || "";
      break;
    case "release":
      input = document.getElementById("releaseInput")?.value.trim() || "";
      break;
  }

  const defaultCmd = fallbackConfig.command || `/${action}`;
  const baseCmd = actionConfig.command || defaultCmd;

  // Build slash command
  let cmd = "";
  if (input) {
    const templateWithInput = actionConfig.promptTemplateWithInput || fallbackConfig.promptTemplateWithInput || `${baseCmd} "{input}"`;
    cmd = templateWithInput.replace("{input}", input).replace("{command}", baseCmd);
  } else {
    const template = actionConfig.promptTemplate || fallbackConfig.promptTemplate || baseCmd;
    cmd = template.replace("{command}", baseCmd);
  }

  // Build natural language prompt
  let prompt = "";
  if (input) {
    const pTemplateWithInput = actionConfig.promptWithInput || fallbackConfig.promptWithInput || `${actionConfig.prompt || fallbackConfig.prompt || baseCmd}: ${input}`;
    prompt = pTemplateWithInput.replace("{input}", input);
  } else {
    prompt = actionConfig.prompt || fallbackConfig.prompt || cmd;
  }

  const baseTitle = actionConfig.displayTitle || fallbackConfig.displayTitle || `⚡ ${baseCmd}`;
  const title = input ? `${baseTitle}: ${input}` : baseTitle;
  const label = actionConfig.name || fallbackConfig.name || baseCmd;

  return { cmd, prompt, title, label, baseCmd };
}

// Start visual execution indicator banner and elapsed timer
function startRunningIndicator(action, meta, btn) {
  currentRunningAction = action;
  activeStartTime = Date.now();

  // Reset classes
  activeCardEl.classList.remove("hidden", "success", "error");
  activeBadgeEl.textContent = t("ui.activeRunning");
  activeTitleEl.textContent = meta.title;
  activeTimerEl.textContent = "0s";

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
    activeTimerEl.textContent = `${elapsed}s`;
  }, 1000);
}

// Stop execution indicator and update status badge
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
    activeBadgeEl.textContent = t("ui.activeCompleted");
    activeTitleEl.textContent = message || `${activeTitleEl.textContent} (${elapsed}s)`;
    activeTimerEl.textContent = `${elapsed}s`;

    setTimeout(() => {
      activeCardEl.classList.add("hidden");
      activeCardEl.classList.remove("success");
    }, 4500);
  } else if (state === "error") {
    activeCardEl.classList.remove("success");
    activeCardEl.classList.add("error");
    activeBadgeEl.textContent = t("ui.activeError");
    activeTitleEl.textContent = message || t("ui.errorToast", { label: "" });
    activeTimerEl.textContent = `${elapsed}s`;

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

// Poll Language Server for completion / status of executing trajectory
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
        logToConsole(`[ERROR]: Agent terminated execution with error.`, true);
        showToast(t("ui.errorToast", { label: meta.label }), true);
        stopRunningIndicator("error", `Error: ${meta.title}`);
        return;
      }

      // 2. Detect cancellation
      if (data.isCanceled) {
        logToConsole(`[CANCELED]: Execution of ${meta.label} was canceled.`, true);
        showToast(t("ui.canceledToast", { label: meta.label }), true);
        stopRunningIndicator("error", `Canceled: ${meta.title}`);
        return;
      }

      // 3. Track running state
      if (data.isRunning) {
        sawRunningState = true;
      } else if (!data.isRunning && (sawRunningState || (initialStepCount !== null && data.stepCount > initialStepCount))) {
        // Trajectory was running and is now completed!
        const elapsed = Math.round((Date.now() - activeStartTime) / 1000);
        logToConsole(`[COMPLETED]: ${meta.title} completed in ${elapsed}s!`);
        showToast(t("ui.completedToast", { label: meta.label }));
        stopRunningIndicator("success", `✅ ${meta.title} completed (${elapsed}s)`);
        return;
      }

      // 4. Safety timeout after 180 seconds
      if (checkCount > 180) {
        stopRunningIndicator("success", `Sent: ${meta.title}`);
        return;
      }
    } catch (err) {
      console.warn("Polling error:", err);
    }
  }, 1000);
}

// Copy text to system clipboard with fallback
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

// Main handler for the 4 action button modes:
// 1. "execute": Runs command immediately in chat
// 2. "command": Inserts slash-command into chat (copies to clipboard for Ctrl+V)
// 3. "prompt":  Inserts AI prompt into chat (copies to clipboard for Ctrl+V)
// 4. "copy":    Copies both slash-command and prompt to clipboard
async function handleAction(action, mode = "execute", btnElement = null) {
  const meta = getActionMeta(action);
  if (!meta.cmd) return;

  const btn = btnElement || document.getElementById(`btn-exec-${action}`) || (window.event ? window.event.currentTarget : null);

  switch (mode) {
    case "execute": {
      // ⚡ Execute directly in chat (Enter)
      startRunningIndicator(action, meta, btn);
      logToConsole(`⚡ [EXECUTE]: ${meta.cmd}\n⏳ Dispatching to active Antigravity chat...`);

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
          logToConsole(`✅ Command ${meta.cmd} delivered to chat!`);
          showToast(t("ui.executingToast", { label: meta.label }));
          monitorExecution(action, meta);
        } else {
          logToConsole(`❌ [SEND ERROR]: ${data.error}`, true);
          showToast(t("ui.sendError"), true);
          stopRunningIndicator("error", data.error || t("ui.sendError"));
        }
      } catch (err) {
        logToConsole(`❌ [ERROR]: ${err.message}. Copying command to clipboard...`, true);
        stopRunningIndicator("error", "Connection error");
        await copyToClipboard(meta.cmd);
        showToast(t("ui.connError"), true);
      }
      break;
    }

    case "command": {
      // ⌨️ Command: copy slash command to insert into chat (Ctrl+V) without Enter
      logToConsole(`⌨️ [COMMAND]: "${meta.cmd}"\n📋 Copied to clipboard. Paste into chat via Ctrl+V.`);
      await copyToClipboard(meta.cmd);
      // Attempt postMessage to parent frame as progressive enhancement
      try {
        window.parent?.postMessage({ type: "insert-chat", text: meta.cmd }, "*");
      } catch {}
      showToast(t("ui.toastCommandCopied", { cmd: meta.cmd }));
      break;
    }

    case "prompt": {
      // 💬 Prompt: copy AI prompt to insert into chat (Ctrl+V) without Enter
      logToConsole(`💬 [PROMPT]: "${meta.prompt}"\n📋 Copied to clipboard. Paste into chat via Ctrl+V.`);
      await copyToClipboard(meta.prompt);
      // Attempt postMessage to parent frame as progressive enhancement
      try {
        window.parent?.postMessage({ type: "insert-chat", text: meta.prompt }, "*");
      } catch {}
      showToast(t("ui.toastPromptCopied"));
      break;
    }

    case "copy": {
      // 📋 Copy: copy slash command AND its full prompt together
      const combined = `${meta.cmd}\n\n${meta.prompt}`;
      logToConsole(`📋 [COPY]: Slash command & prompt copied to clipboard:\n${combined}`);
      await copyToClipboard(combined);
      showToast(t("ui.toastBothCopied"));
      break;
    }
  }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  initI18n();
});
