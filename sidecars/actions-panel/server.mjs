import { createServer } from "node:http";
import { readFile, readdir, stat, existsSync, watch } from "node:fs";
import { promisify } from "node:util";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const LOCALES_DIR = join(__dirname, "locales");

const PORT = Number(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || 8910);
const HOST = "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const readFileAsync = promisify(readFile);
const readdirAsync = promisify(readdir);

// Live reload file watchers
const reloadClients = new Set();
let reloadDebounceTimer = null;

function notifyReloadClients() {
  if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer);
  reloadDebounceTimer = setTimeout(() => {
    for (const client of reloadClients) {
      try {
        client.write("data: reload\n\n");
      } catch {}
    }
  }, 150);
}

try {
  if (existsSync(PUBLIC_DIR)) {
    watch(PUBLIC_DIR, { recursive: true }, () => notifyReloadClients());
  }
} catch (e) {
  console.warn("Failed to watch PUBLIC_DIR:", e);
}

try {
  if (existsSync(LOCALES_DIR)) {
    watch(LOCALES_DIR, { recursive: true }, () => notifyReloadClients());
  }
} catch (e) {
  console.warn("Failed to watch LOCALES_DIR:", e);
}

// Helper to query Language Server for currently active conversation ID
async function getLatestConversationId() {
  const lsAddr = process.env.ANTIGRAVITY_LS_ADDRESS;
  const csrf = process.env.ANTIGRAVITY_CSRF_TOKEN;
  if (!lsAddr || !csrf) return null;

  try {
    const res = await fetch(`http://${lsAddr}/exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-codeium-csrf-token": csrf
      },
      body: "{}"
    });
    if (!res.ok) return null;
    const data = await res.json();
    const map = data.trajectorySummaries || {};
    const entries = Object.entries(map);
    if (entries.length === 0) return null;
    entries.sort((a, b) => {
      const getT = s => {
        const view = s.annotations?.lastUserViewTime ? new Date(s.annotations.lastUserViewTime).getTime() : 0;
        const input = s.lastUserInputTime ? new Date(s.lastUserInputTime).getTime() : 0;
        const mod = s.lastModifiedTime ? new Date(s.lastModifiedTime).getTime() : 0;
        return Math.max(view, input, mod);
      };
      return getT(b[1]) - getT(a[1]);
    });
    return entries[0][0];
  } catch (err) {
    console.error("Failed to query latest trajectory:", err);
    return null;
  }
}

// Helper to query execution status of a trajectory
async function getTrajectoryStatus(conversationId) {
  const lsAddr = process.env.ANTIGRAVITY_LS_ADDRESS;
  const csrf = process.env.ANTIGRAVITY_CSRF_TOKEN;
  if (!lsAddr || !csrf) {
    return { ok: false, error: "Antigravity Language Server unavailable" };
  }

  const isInvalid = !conversationId ||
    conversationId === "_new" ||
    conversationId === "new" ||
    conversationId === "null" ||
    conversationId === "undefined";

  if (isInvalid) {
    return {
      ok: true,
      conversationId: null,
      status: "CASCADE_RUN_STATUS_IDLE",
      isRunning: false,
      terminationReason: "",
      isError: false,
      isCanceled: false,
      stepCount: 0,
      title: ""
    };
  }

  const targetConvId = conversationId;
  if (!targetConvId) {
    return { ok: false, error: "Conversation not found" };
  }

  try {
    const res = await fetch(`http://${lsAddr}/exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-codeium-csrf-token": csrf
      },
      body: "{}"
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const summary = (data.trajectorySummaries || {})[targetConvId];
    if (!summary) {
      return { ok: false, error: "Trajectory not found" };
    }

    const status = summary.status || "CASCADE_RUN_STATUS_UNSPECIFIED";
    const isRunning = status === "CASCADE_RUN_STATUS_RUNNING" || status === "CASCADE_RUN_STATUS_BUSY";
    const terminationReason = summary.latestExecutorTerminationReason || "";
    const isError = !isRunning && terminationReason === "EXECUTOR_TERMINATION_REASON_ERROR";
    const isCanceled = !isRunning && terminationReason === "EXECUTOR_TERMINATION_REASON_USER_CANCELED";

    return {
      ok: true,
      conversationId: targetConvId,
      status,
      isRunning,
      terminationReason,
      isError,
      isCanceled,
      stepCount: summary.stepCount || 0,
      title: summary.annotations?.title || summary.summary || ""
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

let cachedDefaultModel = "MODEL_PLACEHOLDER_M318";
async function getDefaultModel(lsAddr, csrf) {
  try {
    const res = await fetch(`http://${lsAddr}/exa.language_server_pb.LanguageServerService/GetCascadeModelConfigData`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-codeium-csrf-token": csrf },
      body: "{}"
    });
    if (res.ok) {
      const data = await res.json();
      const m = data.defaultOverrideModelConfig?.modelOrAlias?.model || data.clientModelConfigs?.[0]?.modelOrAlias?.model;
      if (m) cachedDefaultModel = m;
    }
  } catch {}
  return cachedDefaultModel;
}

// Helper to normalize file URIs for comparison
function normalizeUri(uri) {
  return (uri || "").replace(/%3A/gi, ":").toLowerCase().replace(/\/+$/, "");
}

// Resolve workspace URIs if not provided or empty
async function resolveWorkspaceUris(providedUris, lsAddr, csrf) {
  if (Array.isArray(providedUris) && providedUris.length > 0) {
    return providedUris;
  }
  try {
    const trajRes = await fetch(`http://${lsAddr}/exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-codeium-csrf-token": csrf
      },
      body: "{}"
    });
    if (trajRes.ok) {
      const trajData = await trajRes.json();
      const summaries = trajData.trajectorySummaries || {};
      const keys = Object.keys(summaries);
      for (let i = keys.length - 1; i >= 0; i--) {
        const meta = summaries[keys[i]]?.trajectoryMetadata;
        if (meta?.workspaceUris && meta.workspaceUris.length > 0) {
          return meta.workspaceUris;
        }
        if (meta?.workspaces && meta.workspaces.length > 0) {
          const uris = meta.workspaces.map(w => w.workspaceFolderAbsoluteUri).filter(Boolean);
          if (uris.length > 0) return uris;
        }
      }
    }
  } catch (err) {
    console.warn("[Antigravity Actions] resolveWorkspaceUris error:", err.message);
  }
  return [];
}

// Resolve active projectId for workspace URIs
async function resolveProjectId(workspaceUris, lsAddr, csrf) {
  const normUris = (Array.isArray(workspaceUris) ? workspaceUris : [workspaceUris])
    .filter(Boolean)
    .map(normalizeUri);

  try {
    const trajRes = await fetch(`http://${lsAddr}/exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-codeium-csrf-token": csrf
      },
      body: "{}"
    });
    if (trajRes.ok) {
      const trajData = await trajRes.json();
      const summaries = trajData.trajectorySummaries || {};
      const keys = Object.keys(summaries);

      // 1. First pass: match against trajectory workspace URIs
      for (let i = keys.length - 1; i >= 0; i--) {
        const meta = summaries[keys[i]]?.trajectoryMetadata;
        if (!meta || !meta.projectId || meta.projectId === "outside-of-project") continue;

        const uris = [
          ...(meta.workspaceUris || []),
          ...(meta.workspaces || []).map(w => w.workspaceFolderAbsoluteUri)
        ].filter(Boolean).map(normalizeUri);

        for (const u of uris) {
          if (normUris.length === 0 || normUris.some(nu => nu === u || u.startsWith(nu) || nu.startsWith(u))) {
            return meta.projectId;
          }
        }
      }

      // 2. Second pass: fallback to latest trajectory with valid projectId
      for (let i = keys.length - 1; i >= 0; i--) {
        const meta = summaries[keys[i]]?.trajectoryMetadata;
        if (meta?.projectId && meta.projectId !== "outside-of-project") {
          return meta.projectId;
        }
      }
    }
  } catch (err) {
    console.warn("[Antigravity Actions] resolveProjectId (trajectories) error:", err.message);
  }

  try {
    // 3. Fallback: check ListProjects and ReadProject
    const listRes = await fetch(`http://${lsAddr}/exa.language_server_pb.LanguageServerService/ListProjects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-codeium-csrf-token": csrf
      },
      body: "{}"
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const projectIds = (listData.projectIds || []).filter(p => p !== "outside-of-project");
      for (const pid of projectIds) {
        const pRes = await fetch(`http://${lsAddr}/exa.language_server_pb.LanguageServerService/ReadProject`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-codeium-csrf-token": csrf
          },
          body: JSON.stringify({ id: pid })
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          const resources = pData.project?.projectResources?.resources || [];
          for (const r of resources) {
            const folderUri = normalizeUri(r.gitFolder?.folderUri || r.folderUri);
            if (folderUri && normUris.some(nu => nu === folderUri || folderUri.startsWith(nu) || nu.startsWith(folderUri))) {
              return pid;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Antigravity Actions] resolveProjectId (projects) error:", err.message);
  }

  return process.env.ANTIGRAVITY_PROJECT_ID || null;
}

// Send message directly to Antigravity chat via LanguageServerService
async function sendToChatRPC(message, conversationId, displayTitle, workspaceUris = []) {
  const lsAddr = process.env.ANTIGRAVITY_LS_ADDRESS;
  const csrf = process.env.ANTIGRAVITY_CSRF_TOKEN;
  if (!lsAddr || !csrf) {
    return { ok: false, error: "Antigravity Language Server unavailable (environment variables missing)" };
  }

  const isExplicitNew = !conversationId ||
    conversationId === "_new" ||
    conversationId === "new" ||
    conversationId === "null" ||
    conversationId === "undefined";

  let targetConvId = conversationId;
  let isNewConversation = false;

  if (isExplicitNew) {
    // When executing in a new conversation tab, start a fresh cascade attached to the current project
    try {
      const targetWorkspaceUris = await resolveWorkspaceUris(workspaceUris, lsAddr, csrf);
      const projectId = await resolveProjectId(targetWorkspaceUris, lsAddr, csrf);

      const startBody = {
        source: "CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT"
      };
      if (targetWorkspaceUris.length > 0) {
        startBody.workspaceUris = targetWorkspaceUris;
      }
      if (projectId) {
        startBody.projectEnvConfig = {
          projectId
        };
      }

      const startRes = await fetch(`http://${lsAddr}/exa.language_server_pb.LanguageServerService/StartCascade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-codeium-csrf-token": csrf
        },
        body: JSON.stringify(startBody)
      });
      if (startRes.ok) {
        const startData = await startRes.json();
        if (startData.cascadeId) {
          targetConvId = startData.cascadeId;
          isNewConversation = true;
          console.log(`[Antigravity Actions] Started new cascade in project ${projectId || 'standalone'}: ${targetConvId}`);
        }
      } else {
        console.warn("[Antigravity Actions] StartCascade non-ok:", startRes.status, await startRes.text());
      }
    } catch (err) {
      console.warn("[Antigravity Actions] StartCascade error:", err);
    }
  }

  if (!targetConvId || targetConvId === "_new" || targetConvId === "new") {
    // Fallback only if StartCascade failed and no valid targetConvId exists
    targetConvId = await getLatestConversationId() || process.env.ANTIGRAVITY_CONVERSATION_ID;
  }

  if (!targetConvId) {
    return { ok: false, error: "Active Antigravity conversation not found" };
  }

  const title = displayTitle || `⚡ ${message.split("\n")[0].slice(0, 60)}`;
  const model = await getDefaultModel(lsAddr, csrf);

  // 1. Try SendUserCascadeMessage first: this inserts a real User Message bubble in chat
  try {
    const userRes = await fetch(`http://${lsAddr}/exa.language_server_pb.LanguageServerService/SendUserCascadeMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-codeium-csrf-token": csrf
      },
      body: JSON.stringify({
        cascadeId: targetConvId,
        items: [{ text: message }],
        cascadeConfig: {
          plannerConfig: {
            planModel: model
          }
        }
      })
    });

    if (userRes.ok) {
      return {
        ok: true,
        recipient: targetConvId,
        isNewConversation,
        delivered: true,
        method: "user_cascade",
        title
      };
    } else {
      console.warn("SendUserCascadeMessage returned non-ok status:", userRes.status, await userRes.text());
    }
  } catch (err) {
    console.warn("SendUserCascadeMessage failed, falling back to SendAgentMessage:", err);
  }

  // 2. Fallback to SendAgentMessage
  try {
    const agentRes = await fetch(`http://${lsAddr}/exa.language_server_pb.LanguageServerService/SendAgentMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-codeium-csrf-token": csrf
      },
      body: JSON.stringify({
        recipient: targetConvId,
        content: message,
        displayTitle: title,
        display_title: title
      })
    });

    if (agentRes.ok) {
      return {
        ok: true,
        recipient: targetConvId,
        isNewConversation,
        delivered: true,
        method: "agent_message",
        title
      };
    } else {
      const errText = await agentRes.text();
      return { ok: false, error: `RPC error: ${errText}` };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Sidecar-Token");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Locales discovery endpoint: dynamically returns available languages based on files in locales/
  if (url.pathname === "/api/locales" && req.method === "GET") {
    try {
      const files = existsSync(LOCALES_DIR) ? await readdirAsync(LOCALES_DIR) : [];
      const locales = [];
      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const raw = await readFileAsync(join(LOCALES_DIR, file), "utf-8");
            const data = JSON.parse(raw);
            locales.push({
              code: data.code || file.replace(/\.json$/, ""),
              name: data.name || file.replace(/\.json$/, "")
            });
          } catch {}
        }
      }
      // Ensure English is listed first if present
      locales.sort((a, b) => (a.code === "en" ? -1 : b.code === "en" ? 1 : a.code.localeCompare(b.code)));
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(locales));
      return;
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // Single locale endpoint: e.g. /api/locales/en or /api/locales/ru
  if (url.pathname.startsWith("/api/locales/") && req.method === "GET") {
    const code = url.pathname.replace(/^\/api\/locales\//, "").replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = join(LOCALES_DIR, `${code}.json`);
    if (existsSync(filePath)) {
      try {
        const content = await readFileAsync(filePath, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(content);
        return;
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: `Locale '${code}' not found` }));
    return;
  }

  // Plugin metadata endpoint
  if (url.pathname === "/api/info" && req.method === "GET") {
    try {
      const pluginJsonPath = join(__dirname, "..", "..", "plugin.json");
      if (existsSync(pluginJsonPath)) {
        const content = await readFileAsync(pluginJsonPath, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(content);
        return;
      }
    } catch (e) {
      console.warn("Failed to read plugin.json:", e);
    }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      version: "1.1.0",
      name: "antigravity-actions",
      displayName: "Antigravity Actions",
      repository: "https://github.com/alezhu/antigravity-actions"
    }));
    return;
  }

  // Live reload SSE endpoint
  if (url.pathname === "/api/live-reload" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    });
    res.write("retry: 1000\n\n");
    reloadClients.add(res);
    req.on("close", () => {
      reloadClients.delete(res);
    });
    return;
  }

  // Status check endpoint
  if (url.pathname === "/api/status" && (req.method === "GET" || req.method === "POST")) {
    const convId = url.searchParams.get("conversationId") || null;
    const statusData = await getTrajectoryStatus(convId);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(statusData));
    return;
  }

  // API endpoint for sending prompts directly into Antigravity chat
  if ((url.pathname === "/api/send-chat" || url.pathname === "/_sidecar/send-message") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const message = payload.message || payload.content || "";
        const convId = payload.conversationId || url.searchParams.get("conversationId");
        const displayTitle = payload.displayTitle || payload.title;
        const workspaceUris = payload.workspaceUris || [];

        if (!message) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: "Message content cannot be empty" }));
          return;
        }

        const result = await sendToChatRPC(message, convId, displayTitle, workspaceUris);
        res.writeHead(result.ok ? 200 : 500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Assets fallback
  if (url.pathname.startsWith("/assets/")) {
    const rel = url.pathname.replace(/^\/assets\//, "");
    const assetPath = join(__dirname, "..", "..", "assets", rel);
    if (existsSync(assetPath)) {
      const ext = extname(assetPath);
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      try {
        const content = await readFileAsync(assetPath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
        return;
      } catch {}
    }
  }

  // Preload.js bridge for sidecars
  if (url.pathname === "/preload.js") {
    const appDataDir = process.env.ANTIGRAVITY_APP_DATA_DIR || join(os.homedir(), ".gemini", "antigravity");
    const sdkPreload = join(appDataDir, "lib", "node_modules", "sidecar_sdk", "preload.js");
    let content = "";
    if (existsSync(sdkPreload)) {
      try { content = await readFileAsync(sdkPreload, "utf-8"); } catch {}
    }
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    res.end(content || "// preload fallback\n");
    return;
  }

  // Static files serving
  let filePath = join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
  try {
    const fileStat = await promisify(stat)(filePath);
    if (fileStat.isDirectory()) {
      filePath = join(filePath, "index.html");
    }
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = await readFileAsync(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    res.end(content);
  } catch (err) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[Antigravity Actions Sidecar] Running at http://${HOST}:${PORT}`);
});
