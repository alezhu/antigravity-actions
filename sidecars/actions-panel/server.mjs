import { createServer } from "node:http";
import { readFile, stat, existsSync } from "node:fs";
import { promisify } from "node:util";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");

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
    return { ok: false, error: "Языковой сервер Antigravity недоступен" };
  }

  const targetConvId = conversationId || await getLatestConversationId() || process.env.ANTIGRAVITY_CONVERSATION_ID;
  if (!targetConvId) {
    return { ok: false, error: "Диалог не найден" };
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
      return { ok: false, error: "Траектория не найдена" };
    }

    const status = summary.status || "CASCADE_RUN_STATUS_UNSPECIFIED";
    const isRunning = status === "CASCADE_RUN_STATUS_RUNNING" || status === "CASCADE_RUN_STATUS_BUSY";

    return {
      ok: true,
      conversationId: targetConvId,
      status,
      isRunning,
      stepCount: summary.stepCount || 0,
      title: summary.annotations?.title || summary.summary || ""
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Send message directly to Antigravity chat via LanguageServerService
async function sendToChatRPC(message, conversationId, displayTitle) {
  const lsAddr = process.env.ANTIGRAVITY_LS_ADDRESS;
  const csrf = process.env.ANTIGRAVITY_CSRF_TOKEN;
  if (!lsAddr || !csrf) {
    return { ok: false, error: "Языковой сервер Antigravity недоступен (переменные окружения отсутствуют)" };
  }

  const targetConvId = conversationId || await getLatestConversationId() || process.env.ANTIGRAVITY_CONVERSATION_ID;
  if (!targetConvId) {
    return { ok: false, error: "Не найден активный диалог Antigravity" };
  }

  const title = displayTitle || `⚡ ${message.split("\n")[0].slice(0, 60)}`;

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
        items: [{ text: message }]
      })
    });

    if (userRes.ok) {
      return { ok: true, recipient: targetConvId, delivered: true, method: "user_cascade", title };
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
      return { ok: true, recipient: targetConvId, delivered: true, method: "agent_message", title };
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

        if (!message) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: "Текст сообщения пуст" }));
          return;
        }

        const result = await sendToChatRPC(message, convId, displayTitle);
        res.writeHead(result.ok ? 200 : 500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Preload.js bridge for sidecars
  if (url.pathname === "/preload.js") {
    const sdkPreload = "C:/Users/alezhur/.gemini/antigravity/lib/node_modules/sidecar_sdk/preload.js";
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
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[Antigravity Actions Sidecar] Running at http://${HOST}:${PORT}`);
});
