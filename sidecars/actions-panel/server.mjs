import { createServer } from "node:http";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, stat } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
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
  commit: "Сделай git status, сформируй осмысленное сообщение по Conventional Commits и сделай коммит.",
  codereview: "Проведи глубокий Code Review текущих изменений и незакоммиченных файлов: логика, безопасность, потенциальные баги, граничные случаи и читаемость.",
  test: "Запусти тесты проекта, проанализируй результаты выполнения и предложи исправления при ошибках.",
  deploy: "Выполни деплой проекта: проверь статус ветки, линтеры, тесты и запусти сценарий развертывания.",
  release: "Подготовь релиз: определи следующую SemVer-версию, обнови changelog и создай git-тег."
};

async function getProjectDir() {
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
      lastCommit = "Нет коммитов";
    }

    return { ok: true, branch, modifiedCount, stagedCount, totalChanges: lines.length, lastCommit, cwd };
  } catch (err) {
    return { ok: false, error: err.message, cwd };
  }
}

async function handleAction(action, options = {}, cwd) {
  const prompt = PROMPTS[action] || "";

  switch (action) {
    case "commit": {
      const message = (options.message || "").trim();
      if (!message) {
        return { ok: true, action, prompt, note: "Укажите сообщение для прямого коммита или используйте промпт для агента." };
      }
      try {
        await execAsync("git add -A", { cwd });
        const { stdout } = await execAsync(`git commit -m ${JSON.stringify(message)}`, { cwd });
        return { ok: true, action, output: stdout, prompt };
      } catch (err) {
        return { ok: false, action, error: err.message, prompt };
      }
    }

    case "codereview": {
      try {
        const { stdout: diff } = await execAsync("git diff HEAD", { cwd });
        const summary = diff.length === 0 
          ? "Нет незакоммиченных изменений относительно HEAD."
          : `Изменений: ~${diff.split("\n").length} строк diff. Запустите агента для детального ревью.`;
        return { ok: true, action, output: summary, prompt, diffSnippet: diff.slice(0, 2000) };
      } catch (err) {
        return { ok: false, action, error: err.message, prompt };
      }
    }

    case "test": {
      try {
        const { stdout, stderr } = await execAsync("npm test", { cwd });
        return { ok: true, action, output: (stdout || "") + (stderr || ""), prompt };
      } catch (err) {
        return { ok: false, action, output: (err.stdout || "") + (err.stderr || err.message), prompt };
      }
    }

    case "deploy": {
      return {
        ok: true,
        action,
        prompt,
        output: "Деплой инициирован через AI-агента для проверки безопасности и тестов перед сборкой."
      };
    }

    case "release": {
      try {
        let lastTag = "none";
        try {
          const { stdout: tagOut } = await execAsync("git describe --tags --abbrev=0", { cwd });
          lastTag = tagOut.trim();
        } catch {
          lastTag = "Тегов пока нет";
        }
        return { ok: true, action, prompt, output: `Последний тег: ${lastTag}. Используйте агента для автоматического SemVer + Changelog.` };
      } catch (err) {
        return { ok: false, action, error: err.message, prompt };
      }
    }

    default:
      return { ok: false, error: "Неизвестное действие", prompt };
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const cwd = await getProjectDir();

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (url.pathname === "/api/status" && req.method === "GET") {
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
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = join(filePath, "index.html");
    }
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = await readFile(filePath);
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
