import { createServer } from "node:http";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile, stat, existsSync } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execAsync = promisify(exec);
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

const PROMPTS = {
  commit: "Сделай git status, проанализируй git diff, сформируй осмысленное сообщение по Conventional Commits и сделай коммит.",
  codereview: "Проведи глубокий Code Review текущих изменений и незакоммиченных файлов: логика, безопасность, потенциальные баги, граничные случаи и качество кода.",
  test: "Запусти тесты проекта, проанализируй результаты выполнения и предложи исправления при ошибках.",
  deploy: "Выполни процедуру деплоя проекта: проверь статус ветки, линтеры, тесты, сборку и запусти сценарий развертывания.",
  release: "Подготовь релиз проекта: определи следующую SemVer-версию, обнови changelog и создай git-тег."
};

// Find PRELOAD_JS from sidecar_sdk if installed, or provide built-in bridge
let PRELOAD_JS = "";
const sdkPreloadPath = join("C:/Users/alezhur/.gemini/antigravity/lib/node_modules/sidecar_sdk/preload.js");
if (existsSync(sdkPreloadPath)) {
  try {
    PRELOAD_JS = readFile(sdkPreloadPath, "utf-8", (err, data) => { if (!err) PRELOAD_JS = data; });
  } catch {}
}

function resolveWorkspace(requested) {
  if (requested && typeof requested === "string") {
    let clean = requested.trim();
    if (clean.startsWith("file:///")) {
      clean = decodeURIComponent(clean.replace("file:///", ""));
      if (/^[a-zA-Z]:/.test(clean)) {
        clean = clean.replace(/\//g, "\\");
      }
    }
    if (existsSync(clean)) return clean;
  }
  
  // Try parent projects directory or default project folder
  const candidate = "D:\\Projects\\Web\\Front\\antigravity-actions";
  if (existsSync(candidate)) return candidate;
  return process.cwd();
}

async function getGitStatus(cwd) {
  try {
    const { stdout: branchOut } = await execAsync("git branch --show-current", { cwd });
    const branch = branchOut.trim() || "DETACHED";

    const { stdout: statusOut } = await execAsync("git status --porcelain", { cwd });
    const lines = statusOut.split("\n").filter(Boolean);
    const stagedCount = lines.filter(l => /^[MADRC]/.test(l)).length;
    const modifiedCount = lines.filter(l => /^.[MADRCU\?]/.test(l)).length;

    let lastCommit = "";
    try {
      const { stdout: logOut } = await execAsync("git log -1 --oneline", { cwd });
      lastCommit = logOut.trim();
    } catch {
      lastCommit = "Репозиторий без коммитов";
    }

    return { ok: true, branch, modifiedCount, stagedCount, totalChanges: lines.length, lastCommit, cwd };
  } catch (err) {
    return { ok: false, error: err.message, cwd };
  }
}

function sendToAgentAsync(message, conversationId) {
  const exe = process.env.ANTIGRAVITY_AGENTAPI_EXE || "agentapi";
  const convId = conversationId || process.env.ANTIGRAVITY_CONVERSATION_ID;

  let args = [];
  if (convId) {
    args = exe.endsWith("language_server.exe")
      ? ["agentapi", "send-message", convId, message]
      : ["send-message", convId, message];
  } else {
    args = exe.endsWith("language_server.exe")
      ? ["agentapi", "new-conversation", message]
      : ["new-conversation", message];
  }

  try {
    const child = spawn(exe, args, {
      env: process.env,
      stdio: "ignore",
      windowsHide: true,
      detached: true
    });
    child.unref();
    return { ok: true, target: convId || "new-conversation" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleAction(action, options = {}, cwd) {
  const prompt = PROMPTS[action] || "";

  switch (action) {
    case "commit": {
      let message = (options.message || "").trim();

      // Check git status
      const { stdout: statusOut } = await execAsync("git status --porcelain", { cwd });
      const changedFiles = statusOut.split("\n").filter(Boolean);
      if (changedFiles.length === 0) {
        return { ok: false, action, error: "Нет изменений для коммита (рабочая директория чиста)." };
      }

      // If message is empty, auto-generate Conventional Commit message based on changed files
      if (!message) {
        const filenames = changedFiles.map(l => l.slice(3).trim());
        let prefix = "chore";
        if (filenames.some(f => /test|spec/i.test(f))) prefix = "test";
        else if (filenames.some(f => /readme|docs/i.test(f))) prefix = "docs";
        else if (filenames.some(f => /\.(js|ts|jsx|tsx|py|go|rs|html|css)$/i.test(f))) prefix = "feat";

        const sample = filenames.slice(0, 3).join(", ");
        message = `${prefix}: update ${sample}${filenames.length > 3 ? " and others" : ""}`;
      }

      try {
        await execAsync("git add -A", { cwd });
        const { stdout: commitOut } = await execAsync(`git commit -m ${JSON.stringify(message)}`, { cwd });
        const { stdout: logOut } = await execAsync("git log -1 --oneline", { cwd });
        return {
          ok: true,
          action,
          output: `✅ Коммит успешно создан!\n\n${logOut.trim()}\n\nДетали:\n${commitOut.trim()}`,
          prompt
        };
      } catch (err) {
        return { ok: false, action, error: err.message, prompt };
      }
    }

    case "codereview": {
      try {
        const { stdout: diff } = await execAsync("git diff HEAD", { cwd });
        const { stdout: status } = await execAsync("git status --short", { cwd });

        if (!diff.trim() && !status.trim()) {
          return {
            ok: true,
            action,
            output: "Рабочая директория чиста. Нет незакоммиченных изменений относительно HEAD для ревью.",
            prompt
          };
        }

        // Fast static analysis of diff
        const diffLines = diff.split("\n");
        const addedLines = diffLines.filter(l => l.startsWith("+") && !l.startsWith("+++"));
        const warnings = [];

        for (const l of addedLines) {
          if (/console\.(log|warn|error)/.test(l)) warnings.push("⚠️ Обнаружен отладочный вызов console.log");
          if (/TODO|FIXME|HACK/i.test(l)) warnings.push("💡 Обнаружена метка TODO/FIXME");
          if (/api[_-]?key|secret|password|token/i.test(l) && /=|\:/.test(l)) {
            warnings.push("🚨 Внимание: возможно жестко закодирован секрет/токен!");
          }
        }

        const uniqueWarnings = [...new Set(warnings)];
        const summary = [
          "📋 РЕЗУЛЬТАТ ЛОКАЛЬНОГО REVIEW:",
          `• Изменено файлов: ${status.split("\n").filter(Boolean).length}`,
          `• Добавлено строк: ~${addedLines.length}`,
          "",
          uniqueWarnings.length > 0 ? "Найденные замечания:\n" + uniqueWarnings.join("\n") : "✅ Грубых проблем (секреты, забытые TODO) не обнаружено.",
          "",
          "👉 Нажмите 'В чат' для глубокого архитектурного AI-ревью через агента Antigravity."
        ].join("\n");

        return { ok: true, action, output: summary, prompt, diffSnippet: diff.slice(0, 3000) };
      } catch (err) {
        return { ok: false, action, error: err.message, prompt };
      }
    }

    case "test": {
      try {
        // Detect test runner
        let testCmd = "";
        const pkgPath = join(cwd, "package.json");
        if (existsSync(pkgPath)) {
          testCmd = "npm test";
        } else if (existsSync(join(cwd, "pytest.ini")) || existsSync(join(cwd, "setup.py"))) {
          testCmd = "pytest";
        } else if (existsSync(join(cwd, "Cargo.toml"))) {
          testCmd = "cargo test";
        } else if (existsSync(join(cwd, "go.mod"))) {
          testCmd = "go test ./...";
        } else {
          testCmd = "npm test";
        }

        const { stdout, stderr } = await execAsync(testCmd, { cwd, timeout: 60000 });
        return {
          ok: true,
          action,
          output: `✅ Тесты выполнены (${testCmd}):\n\n${stdout || ""}\n${stderr || ""}`,
          prompt
        };
      } catch (err) {
        const out = (err.stdout || "") + "\n" + (err.stderr || err.message);
        return {
          ok: false,
          action,
          output: `❌ Тесты завершились с ошибкой:\n\n${out}\n\n👉 Нажмите 'В чат', чтобы агент помог исправить ошибку.`,
          prompt
        };
      }
    }

    case "deploy": {
      try {
        const pkgPath = join(cwd, "package.json");
        let deployCmd = "";
        if (existsSync(pkgPath)) {
          const pkg = JSON.parse(await readFileAsync(pkgPath, "utf-8"));
          if (pkg.scripts && pkg.scripts.deploy) {
            deployCmd = "npm run deploy";
          } else if (pkg.scripts && pkg.scripts.build) {
            deployCmd = "npm run build";
          }
        }

        if (deployCmd) {
          const { stdout, stderr } = await execAsync(deployCmd, { cwd, timeout: 120000 });
          return {
            ok: true,
            action,
            output: `🚀 Сборка/Деплой выполнен (${deployCmd}):\n\n${stdout || ""}\n${stderr || ""}`,
            prompt
          };
        } else {
          return {
            ok: true,
            action,
            output: "В проекте не настроен явный скрипт deploy/build. Нажмите 'В чат', чтобы AI-агент настроил сценарий деплоя.",
            prompt
          };
        }
      } catch (err) {
        return {
          ok: false,
          action,
          output: `Ошибка при сборке/деплое:\n${err.stdout || err.message}`,
          prompt
        };
      }
    }

    case "release": {
      try {
        const pkgPath = join(cwd, "package.json");
        let currentVersion = "1.0.0";
        if (existsSync(pkgPath)) {
          const pkg = JSON.parse(await readFileAsync(pkgPath, "utf-8"));
          currentVersion = pkg.version || currentVersion;
        }

        let lastTag = "теги отсутствуют";
        try {
          const { stdout: tagOut } = await execAsync("git describe --tags --abbrev=0", { cwd });
          lastTag = tagOut.trim();
        } catch {}

        return {
          ok: true,
          action,
          output: `📦 СТАТУС РЕЛИЗА:\n• Текущая версия: v${currentVersion}\n• Последний Git-тег: ${lastTag}\n\n👉 Нажмите 'В чат', чтобы агент сгенерировал CHANGELOG, увеличил SemVer и создал тег.`,
          prompt
        };
      } catch (err) {
        return { ok: false, action, error: err.message, prompt };
      }
    }

    default:
      return { ok: false, error: "Неизвестное действие", prompt };
  }
}

const readFileAsync = promisify(readFile);

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

  // Serve preload.js for Sidecar SDK
  if (url.pathname === "/preload.js") {
    let content = PRELOAD_JS;
    if (!content && existsSync(sdkPreloadPath)) {
      try { content = await readFileAsync(sdkPreloadPath, "utf-8"); } catch {}
    }
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    res.end(content || "// preload fallback\n");
    return;
  }

  // Antigravity Sidecar SDK built-in APIs
  if (url.pathname === "/_sidecar/send-message" || url.pathname === "/api/send-chat") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const msg = payload.message || payload.content || "";
        const convId = payload.conversationId || url.searchParams.get("conversationId");
        const result = sendToAgentAsync(msg, convId);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/_sidecar/new-conversation") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const result = sendToAgentAsync(payload.message || "", null);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/status" && req.method === "GET") {
    const cwd = resolveWorkspace(url.searchParams.get("workspacePath"));
    const data = await getGitStatus(cwd);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
    return;
  }

  if (url.pathname === "/api/prompts" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ prompts: PROMPTS }));
    return;
  }

  if (url.pathname === "/api/action" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const cwd = resolveWorkspace(payload.workspacePath);
        const result = await handleAction(payload.action, payload.options, cwd);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Static file serving
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
