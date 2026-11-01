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
  const rawId = window.sidecar?.conversationId || params.get("conversationId") || null;
  if (!rawId || rawId === "_new" || rawId === "new" || rawId === "null" || rawId === "undefined") {
    return null;
  }
  return rawId;
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

  // Ensure language hint is included when active locale specifies it
  const langHint = actionConfig.langHint || currentTranslations.langHint || (currentLocale === "ru" ? "отвечай на русском языке" : "");
  if (langHint && !cmd.toLowerCase().includes(langHint.toLowerCase())) {
    cmd = `${cmd} (${langHint})`;
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
  if (activeCardEl) {
    activeCardEl.classList.remove("hidden", "success", "error", "canceled");
    if (activeBadgeEl) activeBadgeEl.textContent = t("ui.activeRunning");
    if (activeTitleEl) activeTitleEl.textContent = meta.title;
    if (activeTimerEl) activeTimerEl.textContent = "0s";
  }

  // Highlight specific action card
  document.querySelectorAll(".action-card").forEach(c => c.classList.remove("running"));
  const card = document.getElementById(`card-${action}`);
  if (card) card.classList.add("running");

  // Disable all execute buttons while an action is in progress to prevent duplicate requests
  document.querySelectorAll(".btn-primary").forEach(b => {
    b.disabled = true;
  });

  // Visual indication on button
  if (btn) {
    if (!btn.getAttribute("data-orig")) {
      btn.setAttribute("data-orig", btn.textContent);
    }
    btn.textContent = `⏳ ${meta.label}...`;
  }

  // Timer interval
  if (activeTimerInterval) {
    clearInterval(activeTimerInterval);
    activeTimerInterval = null;
  }
  activeTimerInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - activeStartTime) / 1000);
    if (activeTimerEl) activeTimerEl.textContent = `${elapsed}s`;
  }, 1000);
}

// Stop execution indicator and update status badge
function stopRunningIndicator(state = "success", message = "") {
  if (activeTimerInterval) {
    clearInterval(activeTimerInterval);
    activeTimerInterval = null;
  }
  if (activePollInterval) {
    clearInterval(activePollInterval);
    activePollInterval = null;
  }

  const elapsed = Math.round((Date.now() - activeStartTime) / 1000);

  // Restore button text and re-enable buttons
  document.querySelectorAll(".btn-primary").forEach(btn => {
    const orig = btn.getAttribute("data-orig");
    if (orig) btn.textContent = orig;
    btn.disabled = false;
  });
  document.querySelectorAll(".btn-secondary").forEach(btn => {
    btn.disabled = false;
  });

  // Clear card highlight
  document.querySelectorAll(".action-card").forEach(c => c.classList.remove("running"));

  if (activeCardEl) {
    activeCardEl.classList.remove("success", "error", "canceled");

    if (state === "success") {
      activeCardEl.classList.add("success");
      if (activeBadgeEl) activeBadgeEl.textContent = t("ui.activeCompleted");
      if (activeTitleEl) activeTitleEl.textContent = message || `${activeTitleEl.textContent} (${elapsed}s)`;
      if (activeTimerEl) activeTimerEl.textContent = `${elapsed}s`;

      setTimeout(() => {
        activeCardEl.classList.add("hidden");
        activeCardEl.classList.remove("success");
      }, 4500);
    } else if (state === "canceled") {
      activeCardEl.classList.add("canceled");
      if (activeBadgeEl) activeBadgeEl.textContent = t("ui.activeCanceled");
      if (activeTitleEl) activeTitleEl.textContent = message || t("ui.canceledToast", { label: "" });
      if (activeTimerEl) activeTimerEl.textContent = `${elapsed}s`;

      setTimeout(() => {
        activeCardEl.classList.add("hidden");
        activeCardEl.classList.remove("canceled");
      }, 4500);
    } else if (state === "error") {
      activeCardEl.classList.add("error");
      if (activeBadgeEl) activeBadgeEl.textContent = t("ui.activeError");
      if (activeTitleEl) activeTitleEl.textContent = message || t("ui.errorToast", { label: "" });
      if (activeTimerEl) activeTimerEl.textContent = `${elapsed}s`;

      setTimeout(() => {
        activeCardEl.classList.add("hidden");
        activeCardEl.classList.remove("error");
      }, 5000);
    } else {
      activeCardEl.classList.add("hidden");
    }
  }

  currentRunningAction = null;
}

// Poll Language Server for completion / status of executing trajectory
function monitorExecution(action, meta, targetConvId = null) {
  // Always stop and clear any existing polling interval before starting a new one
  if (activePollInterval) {
    clearInterval(activePollInterval);
    activePollInterval = null;
  }

  let sawRunningState = false;
  let checkCount = 0;
  let initialStepCount = null;
  let isStopped = false;

  const pollIntervalId = setInterval(async () => {
    if (isStopped) {
      clearInterval(pollIntervalId);
      return;
    }

    checkCount++;
    try {
      const convId = targetConvId || getActiveConversationId() || "";
      const res = await fetch(`/api/status?conversationId=${encodeURIComponent(convId)}`);
      if (!res.ok) return;
      const data = await res.json();

      if (isStopped) {
        clearInterval(pollIntervalId);
        return;
      }

      if (initialStepCount === null && typeof data.stepCount === "number") {
        initialStepCount = data.stepCount;
      }

      // Self-cleanup helper ensuring interval is immediately destroyed
      const stopSelf = () => {
        isStopped = true;
        clearInterval(pollIntervalId);
        if (activePollInterval === pollIntervalId) {
          activePollInterval = null;
        }
      };

      // 1. Detect cancellation (Language server stopped due to user cancellation)
      if (data.isCanceled) {
        stopSelf();
        try {
          logToConsole(`[CANCELED]: Execution of ${meta.label} was canceled.`, true);
          showToast(t("ui.canceledToast", { label: meta.label }), true);
          stopRunningIndicator("canceled", `Canceled: ${meta.title}`);
        } catch (e) {
          console.error("Error handling cancellation in UI:", e);
        }
        return;
      }

      // 2. Detect explicit error
      if (data.isError) {
        stopSelf();
        try {
          logToConsole(`[ERROR]: Agent terminated execution with error.`, true);
          showToast(t("ui.errorToast", { label: meta.label }), true);
          stopRunningIndicator("error", `Error: ${meta.title}`);
        } catch (e) {
          console.error("Error handling error status in UI:", e);
        }
        return;
      }

      // 3. Track running state and normal completion
      if (data.isRunning) {
        sawRunningState = true;
      } else if (!data.isRunning && (sawRunningState || (initialStepCount !== null && data.stepCount > initialStepCount))) {
        stopSelf();
        try {
          const elapsed = Math.round((Date.now() - activeStartTime) / 1000);
          logToConsole(`[COMPLETED]: ${meta.title} completed in ${elapsed}s!`);
          showToast(t("ui.completedToast", { label: meta.label }));
          stopRunningIndicator("success", `✅ ${meta.title} completed (${elapsed}s)`);
        } catch (e) {
          console.error("Error handling completion in UI:", e);
        }
        return;
      }

      // 4. Safety timeout after 180 seconds
      if (checkCount > 180) {
        stopSelf();
        try {
          stopRunningIndicator("success", `Sent: ${meta.title}`);
        } catch (e) {
          console.error("Error handling timeout in UI:", e);
        }
        return;
      }
    } catch (err) {
      console.warn("Polling error:", err);
    }
  }, 1000);

  activePollInterval = pollIntervalId;
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

// Main handler for action button modes:
// 1. "execute": Runs command immediately in chat
// 2. "copy":    Copies full AI prompt to clipboard for Ctrl+V
async function handleAction(action, mode = "execute", btnElement = null) {
  const meta = getActionMeta(action);
  if (!meta.cmd) return;

  const btn = btnElement || document.getElementById(`btn-exec-${action}`) || (window.event ? window.event.currentTarget : null);

  switch (mode) {
    case "execute": {
      // Guard against concurrent execution
      if (currentRunningAction) {
        showToast(t("ui.alreadyRunning"), true);
        return;
      }

      // ⚡ Execute directly in chat (Enter)
      startRunningIndicator(action, meta, btn);
      logToConsole(`⚡ [EXECUTE]: ${meta.cmd}\n⏳ Dispatching to active Antigravity chat...`);

      try {
        const convId = getActiveConversationId();
        let workspaceUris = [];
        if (window.sidecar?.getWorkspaceUris) {
          try {
            workspaceUris = await window.sidecar.getWorkspaceUris();
          } catch {}
        }

        const res = await fetch("/api/send-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: meta.cmd,
            displayTitle: meta.title,
            conversationId: convId,
            workspaceUris: workspaceUris
          })
        });

        const data = await res.json();
        if (data.ok) {
          // If a new conversation was created, focus/switch to it in Antigravity
          if (data.isNewConversation && data.recipient) {
            try {
              if (window.sidecar?.ui?.toggleConversation) {
                window.sidecar.ui.toggleConversation(data.recipient);
              } else {
                window.parent?.postMessage({
                  type: 'toggle-conversation',
                  payload: { conversationId: data.recipient }
                }, '*');
              }
            } catch (err) {
              console.warn("Failed to toggle conversation:", err);
            }
          }
          logToConsole(`✅ Command ${meta.cmd} delivered to chat!`);
          showToast(t("ui.executingToast", { label: meta.label }));
          monitorExecution(action, meta, data.recipient);
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

    case "copy": {
      // 📋 Copy: copy AI prompt to clipboard and shift focus to parent window
      await copyToClipboard(meta.prompt);
      try {
        window.parent?.focus();
      } catch {}
      logToConsole(`📋 [COPY]: Prompt copied to clipboard:\n"${meta.prompt}"\nPaste into chat via Ctrl+V.`);
      showToast(t("ui.toastPromptCopied"));
      break;
    }
  }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  initI18n();
});
