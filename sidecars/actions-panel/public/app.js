// Antigravity Actions Sidecar Frontend

const consoleEl = document.getElementById("consoleOutput");
const toastEl = document.getElementById("toast");
const activeCardEl = document.getElementById("activeCommandCard");
const activeBadgeEl = document.getElementById("activeCommandBadge");
const activeTitleEl = document.getElementById("activeCommandTitle");
const activeTimerEl = document.getElementById("activeCommandTimer");
const langSelectEl = document.getElementById("langSelect");
const logDotEl = document.getElementById("logDot");
const emptyCommandsStateEl = document.getElementById("emptyCommandsState");

let activeTimerInterval = null;
let activePollInterval = null;
let activeStartTime = 0;
let currentRunningAction = null;
let currentTab = "commands";

// Discovered actions from skills/ subdirectories
let registeredActions = [];
let ALL_ACTIONS = [];
const aliasToIdMap = new Map();
let hiddenActions = new Set();

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

// HTML escape helper
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Dynamically fetch discovered actions from server
async function loadActions() {
  try {
    const res = await fetch("/api/actions");
    if (res.ok) {
      registeredActions = await res.json();
    }
  } catch (err) {
    console.warn("Failed to load actions:", err);
  }

  ALL_ACTIONS = registeredActions.map(a => a.id);
  aliasToIdMap.clear();
  registeredActions.forEach(a => {
    aliasToIdMap.set(a.id, a.id);
    if (Array.isArray(a.aliases)) {
      a.aliases.forEach(al => aliasToIdMap.set(al, a.id));
    }
  });
}

// Dynamically render action cards in Commands tab
function renderActions() {
  const container = getActionsContainer();
  if (!container) return;

  const previousInputs = {};
  registeredActions.forEach(act => {
    const el = document.getElementById(`input-${act.id}`);
    if (el && el.value) previousInputs[act.id] = el.value;
  });

  container.innerHTML = "";

  registeredActions.forEach(act => {
    const actLocale = currentTranslations.actions?.[act.id] || fallbackTranslations.actions?.[act.id] || {};
    const name = actLocale.name || act.id;
    const desc = actLocale.desc || act.command || "";
    const placeholder = actLocale.placeholder || "";

    const card = document.createElement("div");
    card.className = "action-card";
    card.id = `card-${act.id}`;
    card.setAttribute("data-action", act.id);
    card.setAttribute("draggable", "true");

    let iconHtml = "";
    if (act.iconUrl) {
      iconHtml = `<img src="${act.iconUrl}" class="action-icon-img" alt="${escapeHtml(name)}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline-flex';" /><span class="action-icon-fallback" style="display:none">${act.emoji || "⚡"}</span>`;
    } else {
      iconHtml = `<span>${act.emoji || "⚡"}</span>`;
    }

    let inputHtml = "";
    if (act.hasInput !== false) {
      const prevVal = previousInputs[act.id] || "";
      inputHtml = `
        <div class="action-inputs">
          <input type="text" id="input-${act.id}" value="${escapeHtml(prevVal)}" placeholder="${escapeHtml(placeholder)}" />
        </div>
      `;
    }

    card.innerHTML = `
      <div class="action-header">
        <span class="drag-handle" title="${escapeHtml(t("ui.dragHandleTitle"))}" aria-label="Drag to reorder">⠿</span>
        <span class="action-icon">${iconHtml}</span>
        <div class="action-info">
          <span class="action-name">${escapeHtml(name)}</span>
          <span class="action-desc">${escapeHtml(desc)}</span>
        </div>
        <button class="btn-hide-action" onclick="event.stopPropagation(); hideAction('${act.id}')" title="${escapeHtml(t("ui.btnHideActionTitle"))}" aria-label="Hide command">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        </button>
      </div>
      ${inputHtml}
      <div class="btn-group">
        <button class="btn btn-primary" id="btn-exec-${act.id}" onclick="handleAction('${act.id}', 'execute')" title="${escapeHtml(t("ui.btnExecuteTitle"))}">
          ${escapeHtml(t("ui.btnExecute"))}
        </button>
        <button class="btn btn-secondary" onclick="handleAction('${act.id}', 'copy')" title="${escapeHtml(t("ui.btnCopyTitle"))}">
          ${escapeHtml(t("ui.btnCopy"))}
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

// Dynamically render visibility items in Settings tab
function renderVisibilityList() {
  const visContainer = document.getElementById("visibilityList");
  if (!visContainer) return;

  visContainer.innerHTML = "";

  registeredActions.forEach(act => {
    const actLocale = currentTranslations.actions?.[act.id] || fallbackTranslations.actions?.[act.id] || {};
    const name = actLocale.name || act.id;

    let iconHtml = "";
    if (act.iconUrl) {
      iconHtml = `<img src="${act.iconUrl}" class="visibility-item-icon-img" alt="${escapeHtml(name)}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline-flex';" /><span style="display:none">${act.emoji || "⚡"}</span>`;
    } else {
      iconHtml = `<span>${act.emoji || "⚡"}</span>`;
    }

    const item = document.createElement("div");
    item.className = "visibility-item";
    item.innerHTML = `
      <div class="visibility-item-left">
        <span class="visibility-item-icon">${iconHtml}</span>
        <div class="visibility-item-labels">
          <span class="visibility-item-name">${escapeHtml(name)}</span>
          <span class="visibility-item-cmd">${escapeHtml(act.command)}</span>
        </div>
      </div>
      <label class="toggle-switch" title="Toggle ${escapeHtml(name)}">
        <input type="checkbox" id="toggle-vis-${act.id}" ${hiddenActions.has(act.id) ? "" : "checked"} onchange="setActionVisibility('${act.id}', this.checked)">
        <span class="toggle-slider"></span>
      </label>
    `;

    visContainer.appendChild(item);
  });
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

  // Update dynamic cards & visibility items
  if (registeredActions.length > 0) {
    renderActions();
    renderVisibilityList();
    restoreCardOrder();
    applyActionVisibility();
    initDragAndDrop();
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

// Tab Switching
function switchTab(tabName) {
  if (!["commands", "log", "settings", "about"].includes(tabName)) return;
  currentTab = tabName;

  document.body.classList.toggle("view-log", tabName === "log");

  document.querySelectorAll(".tab-btn").forEach(btn => {
    const isActive = btn.getAttribute("data-tab") === tabName;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.toggle("active", pane.id === `tab-${tabName}`);
  });

  if (tabName === "log" && logDotEl) {
    logDotEl.classList.add("hidden");
  }
}

// Fetch plugin metadata (version, etc.)
async function loadPluginInfo() {
  try {
    const res = await fetch("/api/info");
    if (res.ok) {
      const data = await res.json();
      if (data.version) {
        const verEl = document.getElementById("aboutVersion");
        if (verEl) verEl.textContent = `v${data.version}`;
      }
    }
  } catch (err) {
    console.warn("Failed to load plugin info:", err);
  }
}

// Command Visibility Management
function loadActionVisibility() {
  try {
    const saved = localStorage.getItem("antigravity_actions_hidden");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const normalized = parsed.map(id => aliasToIdMap.get(id) || id);
        hiddenActions = new Set(normalized.filter(id => ALL_ACTIONS.includes(id)));
      }
    }
  } catch (err) {
    console.warn("Failed to load action visibility:", err);
  }
  applyActionVisibility();
}

function saveActionVisibility() {
  try {
    localStorage.setItem("antigravity_actions_hidden", JSON.stringify(Array.from(hiddenActions)));
  } catch (err) {
    console.warn("Failed to save action visibility:", err);
  }
}

function applyActionVisibility() {
  ALL_ACTIONS.forEach(action => {
    const isHidden = hiddenActions.has(action);
    const card = document.getElementById(`card-${action}`);
    if (card) {
      card.classList.toggle("hidden-action", isHidden);
    }
    const toggle = document.getElementById(`toggle-vis-${action}`);
    if (toggle) {
      toggle.checked = !isHidden;
    }
  });

  checkEmptyCommandsState();
}

function checkEmptyCommandsState() {
  if (!emptyCommandsStateEl) return;
  const allHidden = ALL_ACTIONS.length > 0 && ALL_ACTIONS.every(act => hiddenActions.has(act));
  emptyCommandsStateEl.classList.toggle("hidden", !allHidden);
}

function hideAction(rawAction) {
  const action = aliasToIdMap.get(rawAction) || rawAction;
  hiddenActions.add(action);
  saveActionVisibility();
  applyActionVisibility();
  showToast(t("ui.actionHiddenToast"));
}

function setActionVisibility(rawAction, isVisible) {
  const action = aliasToIdMap.get(rawAction) || rawAction;
  if (isVisible) {
    hiddenActions.delete(action);
  } else {
    hiddenActions.add(action);
  }
  saveActionVisibility();
  applyActionVisibility();
}

function toggleAllCommands(show) {
  if (show) {
    hiddenActions.clear();
  } else {
    ALL_ACTIONS.forEach(act => hiddenActions.add(act));
  }
  saveActionVisibility();
  applyActionVisibility();
}

// Logging to the embedded activity console
function logToConsole(text, isError = false) {
  const time = new Date().toLocaleTimeString();
  const prefix = isError ? "❌ " : "👉 ";
  if (consoleEl) {
    consoleEl.textContent = `[${time}] ${prefix}${text}\n\n` + consoleEl.textContent;
  }

  if (currentTab !== "log" && logDotEl) {
    logDotEl.classList.remove("hidden");
  }
}

// Clear activity console
function clearConsole() {
  if (consoleEl) {
    consoleEl.textContent = t("ui.consoleCleared");
  }
}

// Display transient toast notifications
function showToast(message = "Done!", isError = false) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.style.backgroundColor = isError ? "#ef4444" : "#10b981";
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 3000);
}

// Build action command, prompt, title, and metadata taking active locale into account
function getActionMeta(rawAction) {
  const action = aliasToIdMap.get(rawAction) || rawAction;
  const actionConfig = currentTranslations.actions?.[action] || fallbackTranslations.actions?.[action] || {};
  const fallbackConfig = fallbackTranslations.actions?.[action] || {};

  let inputEl = document.getElementById(`input-${action}`) ||
                document.getElementById(`input-${rawAction}`);

  // Fallback to legacy IDs
  if (!inputEl) {
    if (action === "run-tests" || rawAction === "test") inputEl = document.getElementById("testInput");
    else if (action === "code-review" || rawAction === "codereview") inputEl = document.getElementById("reviewInput");
    else if (action === "commit") inputEl = document.getElementById("commitInput");
    else if (action === "push") inputEl = document.getElementById("pushInput");
    else if (action === "release") inputEl = document.getElementById("releaseInput");
  }

  const input = inputEl ? inputEl.value.trim() : "";

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
function startRunningIndicator(rawAction, meta, btn) {
  const action = aliasToIdMap.get(rawAction) || rawAction;
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
  const card = document.getElementById(`card-${action}`) || document.getElementById(`card-${rawAction}`);
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

      const stopSelf = () => {
        isStopped = true;
        clearInterval(pollIntervalId);
        if (activePollInterval === pollIntervalId) {
          activePollInterval = null;
        }
      };

      // 1. Detect cancellation
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

// Main handler for action button modes
async function handleAction(rawAction, mode = "execute", btnElement = null) {
  const action = aliasToIdMap.get(rawAction) || rawAction;
  const meta = getActionMeta(action);
  if (!meta.cmd) return;

  const btn = btnElement || document.getElementById(`btn-exec-${action}`) || (window.event ? window.event.currentTarget : null);

  switch (mode) {
    case "execute": {
      if (currentRunningAction) {
        showToast(t("ui.alreadyRunning"), true);
        return;
      }

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

// Actions Order & Drag-and-Drop Management
function getActionsContainer() {
  return document.getElementById("actionsList") || document.querySelector(".actions-section");
}

function saveCardOrder() {
  const container = getActionsContainer();
  if (!container) return;
  const cards = container.querySelectorAll(".action-card");
  const order = Array.from(cards)
    .map(c => c.getAttribute("data-action"))
    .filter(Boolean);
  try {
    localStorage.setItem("antigravity_actions_order", JSON.stringify(order));
  } catch (err) {
    console.warn("Failed to save card order:", err);
  }
}

function restoreCardOrder() {
  const container = getActionsContainer();
  if (!container) return;

  let order = ALL_ACTIONS;
  try {
    const saved = localStorage.getItem("antigravity_actions_order");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map(id => aliasToIdMap.get(id) || id);
        const validSaved = normalized.filter(act => ALL_ACTIONS.includes(act));
        const uniqueSaved = Array.from(new Set(validSaved));
        const missing = ALL_ACTIONS.filter(act => !uniqueSaved.includes(act));
        order = [...uniqueSaved, ...missing];
      }
    }
  } catch (err) {
    console.warn("Failed to load saved card order:", err);
  }

  order.forEach(act => {
    const card = document.getElementById(`card-${act}`);
    if (card && container.contains(card)) {
      container.appendChild(card);
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".action-card:not(.dragging):not(.hidden-action)")];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

let draggedCard = null;

function initDragAndDrop() {
  const container = getActionsContainer();
  if (!container) return;

  const cards = container.querySelectorAll(".action-card");
  cards.forEach(card => {
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", (e) => {
      if (e.target.closest("input, button, select, textarea, a")) {
        e.preventDefault();
        return;
      }
      draggedCard = card;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.getAttribute("data-action") || "");
      setTimeout(() => {
        if (draggedCard === card) {
          card.classList.add("dragging");
        }
      }, 0);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      draggedCard = null;
      saveCardOrder();
    });
  });

  if (!container._hasDragOverListener) {
    container._hasDragOverListener = true;
    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!draggedCard) return;

      const afterElement = getDragAfterElement(container, e.clientY);
      if (afterElement == null) {
        container.appendChild(draggedCard);
      } else {
        container.insertBefore(draggedCard, afterElement);
      }
    });
  }
}

// Live reload SSE listener
function initLiveReload() {
  try {
    const es = new EventSource("/api/live-reload");
    es.onmessage = (event) => {
      if (event.data === "reload") {
        window.location.reload();
      }
    };
  } catch (err) {
    console.warn("Live reload unavailable:", err);
  }
}

// Expose handlers globally for HTML attributes
window.handleAction = handleAction;
window.clearConsole = clearConsole;
window.switchTab = switchTab;
window.hideAction = hideAction;
window.setActionVisibility = setActionVisibility;
window.toggleAllCommands = toggleAllCommands;
window.reloadPanel = () => window.location.reload();

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", async () => {
  try {
    localStorage.removeItem("antigravity_actions_active_tab");
  } catch {}
  switchTab("commands");
  initLiveReload();
  await loadActions();
  await initI18n();
  loadPluginInfo();
});
