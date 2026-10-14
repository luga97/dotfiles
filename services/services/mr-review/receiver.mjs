#!/usr/bin/env node
/**
 * mr-review receiver — agente de review de MRs (barbershop-saas)
 *
 * Recibe webhooks de GitLab (via Tailscale Funnel → 127.0.0.1:8080), corre
 * reviews con pi (y PR-Agent docker en A/B) y postea veredictos en los MRs.
 *
 * Env (EnvironmentFile ~/.config/mr-review/secrets.env):
 *   WEBHOOK_SECRET  — secreto compartido del webhook de GitLab
 *   GITLAB_TOKEN    — project access token (scope api) del bot
 *
 * Ver spec-agent-review.md en el repo del proyecto.
 */
import http from "node:http";
import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { isQuotaError, parsePiOutput } from "./pi-output.mjs";

const pexec = promisify(execFile);

// ─── Config ─────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.MR_REVIEW_PORT || "8080", 10);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const GITLAB_TOKEN = process.env.GITLAB_TOKEN || "";
const GITLAB_API = "https://gitlab.com/api/v4";
const PROJECT_ID = 87497446; // luga97/barbershop-saas
const REPO_DIR = path.join(os.homedir(), "repos/mr-review/barbershop-saas");
const STATE_DIR = path.join(os.homedir(), ".local/state/mr-review");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const ZAI_AUTH = path.join(os.homedir(), ".pi/agent/auth.json");
const ENABLE_PR_AGENT = process.env.MR_REVIEW_PR_AGENT !== "0"; // A/B Fase 1
const THREADS_MODE = process.env.MR_REVIEW_THREADS === "1"; // Fase 2: threads resolvibles
const PR_AGENT_MODEL = "glm-5.3-flash"; // mismo modelo que pi: A/B justo
const PI_MODEL = "zai/glm-5.3-flash"; // fijado explícito para determinismo del A/B
const PI_CHAIN = [
  { label: PI_MODEL, args: ["--model", PI_MODEL] },
  { label: "codex:gpt-6-luna", args: ["--provider", "openai-codex", "--model", "gpt-6-luna"] },
  { label: "openrouter:z-ai/glm-5.3-flash", args: ["--provider", "openrouter", "--model", "z-ai/glm-5.3-flash"] },
];
const PI_TIMEOUT_MS = 10 * 60 * 1000;
const PR_AGENT_TIMEOUT_MS = 5 * 60 * 1000;
const DIFF_MAX_CHARS = 50000;
const DOC_MAX_CHARS = 8000;
const MAX_FINDINGS = 8;

const BOT_NAME = "Pi";

if (!WEBHOOK_SECRET || !GITLAB_TOKEN) {
  console.error("[fatal] WEBHOOK_SECRET/GITLAB_TOKEN no definidos (EnvironmentFile?)");
  process.exit(1);
}

// Key z.ai para PR-Agent (pi lee su auth.json por sí solo).
const ZAI_KEY = (() => { try { return JSON.parse(fs.readFileSync(ZAI_AUTH, "utf8")).zai.key; } catch { return ""; } })();
const OR_KEY = (() => { try { return JSON.parse(fs.readFileSync(ZAI_AUTH, "utf8")).openrouter.key; } catch { return ""; } })();

// Docker recibe secretos vía --env-file (nunca -e en argv: un error de exec
// incluiría el comando completo y filtraría tokens al journal).
const PR_AGENT_ENV_FILE = path.join(os.homedir(), ".config/mr-review/pr-agent.env");
fs.mkdirSync(path.dirname(PR_AGENT_ENV_FILE), { recursive: true });
fs.writeFileSync(PR_AGENT_ENV_FILE, [
  "GITLAB__URL=https://gitlab.com",
  `GITLAB__PERSONAL_ACCESS_TOKEN=${GITLAB_TOKEN}`,
  "CONFIG__GIT_PROVIDER=gitlab",
  `ANTHROPIC_API_KEY=${ZAI_KEY}`,
  "ANTHROPIC_API_BASE=https://api.z.ai/api/anthropic",
  `CONFIG__MODEL=anthropic/${PR_AGENT_MODEL}`,
  "CONFIG__CUSTOM_MODEL_MAX_TOKENS=64000",
].join("\n") + "\n", { mode: 0o600 });

// Env alternativo: mismo review vía OpenRouter si la cuota z.ai se agota.
const PR_AGENT_OPENROUTER_ENV = path.join(os.homedir(), ".config/mr-review/pr-agent-openrouter.env");
fs.writeFileSync(PR_AGENT_OPENROUTER_ENV, [
  "GITLAB__URL=https://gitlab.com",
  `GITLAB__PERSONAL_ACCESS_TOKEN=${GITLAB_TOKEN}`,
  "CONFIG__GIT_PROVIDER=gitlab",
  `OPENROUTER_API_KEY=${OR_KEY}`,
  "CONFIG__MODEL=openrouter/z-ai/glm-5.3-flash",
  "CONFIG__CUSTOM_MODEL_MAX_TOKENS=64000",
].join("\n") + "\n", { mode: 0o600 });

function redact(s) {
  let out = String(s);
  if (GITLAB_TOKEN) out = out.split(GITLAB_TOKEN).join("«glpat»");
  if (ZAI_KEY) out = out.split(ZAI_KEY).join("«zai»");
  return out;
}

const log = (...a) => console.log(new Date().toISOString(), ...a.map(x => typeof x === "string" ? redact(x) : x));

/** Spawn con stdin cerrado — pi -p queda colgado si el pipe de stdin queda abierto. */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", err = "";
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Object.assign(new Error(`timeout tras ${Math.round(opts.timeoutMs / 60000)} min`), { killed: true }));
    }, opts.timeoutMs);
    child.stdout.on("data", d => (out += d));
    child.stderr.on("data", d => (err += d));
    child.on("error", e => { clearTimeout(t); reject(e); });
    child.on("close", code => {
      clearTimeout(t);
      if (code === 0) resolve({ stdout: out });
      else reject(Object.assign(new Error(`exit ${code}: ${err.slice(-300)}`), { stderr: err }));
    });
  });
}

async function git(args, opts = {}) {
  return pexec("git", args, { cwd: REPO_DIR, maxBuffer: 20 * 1024 * 1024, ...opts }).then(r => r.stdout);
}

async function gitlab(method, endpoint, body) {
  const res = await fetch(`${GITLAB_API}/projects/${PROJECT_ID}${endpoint}`, {
    method,
    headers: { "PRIVATE-TOKEN": GITLAB_TOKEN, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitLab ${method} ${endpoint} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function safeJson(text) {
  // pi antepone secuencias OSC de terminal; extraer el JSON entre llaves.
  const clean = text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
  const i = clean.indexOf("{");
  const j = clean.lastIndexOf("}");
  if (i === -1 || j <= i) throw new Error("sin JSON en la salida");
  return JSON.parse(clean.slice(i, j + 1));
}

function normalizeVerdict(v) {
  const s = String(v || "").toLowerCase();
  if (s.includes("request") || s.includes("changes")) return "request_changes";
  if (s.includes("approve")) return "approve";
  return null;
}

function fmtK(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function errText(e) {
  if (e.killed) return `timeout tras ${Math.round(PI_TIMEOUT_MS / 60000)} min`;
  if (e.stderr) return redact(String(e.stderr).slice(-350));
  return redact(String(e.message || e).slice(0, 250));
}

// ─── Estado ─────────────────────────────────────────────────────────────────
let state = {};
try { state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { /* primera vez */ }
function saveState() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Cola serial (último SHA por MR gana) ───────────────────────────────────
const pending = new Map(); // iid → {sha, only?}
let working = false;

function enqueue(iid, sha, only) {
  pending.set(iid, { sha, only });
  log(`encolado MR !${iid} @ ${sha.slice(0, 8)}${only ? ` (only: ${only})` : ""} (cola: ${pending.size})`);
  drain();
}

async function drain() {
  if (working) return;
  working = true;
  try {
    while (pending.size > 0) {
      const [iid, job] = pending.entries().next().value;
      pending.delete(iid);
      try {
        await reviewMr(iid, job.sha, job.only);
      } catch (e) {
        log(`ERROR revisando MR !${iid}:`, errText(e));
        if (!job.only) await reportFailure(iid, job.sha, errText(e)).catch(() => {});
      }
    }
  } finally {
    working = false;
  }
}

// ─── Repo local ─────────────────────────────────────────────────────────────
async function ensureRepo() {
  if (!fs.existsSync(path.join(REPO_DIR, ".git"))) {
    fs.mkdirSync(path.dirname(REPO_DIR), { recursive: true });
    log("clonando repo…");
    await pexec("git", ["clone", `https://oauth2:${GITLAB_TOKEN}@gitlab.com/luga97/barbershop-saas.git`, REPO_DIR],
      { maxBuffer: 20 * 1024 * 1024 });
  }
  // Auto-reparación ante rotación de token: el remote siempre lleva el token vigente.
  await git(["remote", "set-url", "origin", `https://oauth2:${GITLAB_TOKEN}@gitlab.com/luga97/barbershop-saas.git`]);
  await git(["fetch", "-q", "origin",
    "+refs/merge-requests/*/head:refs/remotes/mr/*",
    "+refs/heads/main:refs/remotes/origin/main"]);
}

async function reviewMr(iid, sha, only) {
  const t0 = Date.now();
  if (only === "pr-agent") {
    log(`re-view solo pr-agent MR !${iid} @ ${sha.slice(0, 8)}`);
  } else {
    log(`revisando MR !${iid} @ ${sha.slice(0, 8)} (pi${ENABLE_PR_AGENT ? " + pr-agent" : ""})`);
  }

  if (only !== "pr-agent") {
    // Comentario de inicio — la confirmación visible de que el webhook llegó.
    const startNote = await gitlab("POST", `/merge_requests/${iid}/notes`, {
      body: `🤖 ${BOT_NAME} Review — revisando… (\`${sha.slice(0, 8)}\`)`,
    });

    await ensureRepo();
    await git(["checkout", "-q", "--detach", `refs/remotes/mr/${iid}`]);

    const diff = (await git(["diff", "--find-renames", "origin/main...HEAD"])).slice(0, DIFF_MAX_CHARS);
    if (!diff.trim()) {
      await editNote(iid, startNote.id, `🤖 ${BOT_NAME} Review — sin diff contra main, nada que revisar.`);
      return;
    }

    // Contexto del repo: convenciones documentadas (solo si el diff toca código).
    const isCodeDiff = /^diff --git .*(\.(ts|tsx|js|mjs|json|sql)\b)/m.test(diff);
    const docs = [];
    if (isCodeDiff) {
      for (const f of ["AGENTS.md", "backend/AGENTS.md", "client-ui/AGENTS.md"]) {
        try {
          docs.push(`### ${f}\n\n${fs.readFileSync(path.join(REPO_DIR, f), "utf8").slice(0, DOC_MAX_CHARS)}`);
        } catch { /* no existe */ }
      }
    }

    const prompt = isCodeDiff ? [
      "Sos el code reviewer oficial de este proyecto (monorepo npm workspaces: backend NestJS 11 + client-ui React 19).",
      "Revisá el diff del MR contra main con criterio de ingeniería senior: bugs reales, seguridad, errores de diseño,",
      "incumplimiento de las convenciones del repo, y coherencia con la estructura existente (DDD en backend/src/apps/,",
      "módulos por feature en client-ui, i18n trilingüe es/en/pt-BR, Conventional Commits).",
      "No señales detalles de estilo menor. Máximo 8 findings, solo los que valen.",
      "",
      "Respondé EXCLUSIVAMENTE un JSON válido (sin markdown, sin texto antes ni después) con esta forma exacta:",
      '{"verdict": "approve" | "request_changes", "summary": "resumen en español (2-5 oraciones, lenguaje natural)", "findings": [{"severity": "high|medium|low", "file": "ruta", "comment": "hallazgo concreto y accionable"}]}',
      "",
      "=== CONVENCIONES DEL PROYECTO ===",
      ...docs,
      "",
      "=== DIFF DEL MR ===",
      diff,
    ] : [
      "Sos un technical reviewer. Este MR cambia solo documentación/config (sin código ejecutable).",
      "Revisá claridad, precisión técnica, consistencia con el proyecto y que no filtre secretos.",
      "",
      "Respondé EXCLUSIVAMENTE un JSON válido (sin markdown, sin texto antes ni después):",
      '{"verdict": "approve" | "request_changes", "summary": "resumen en español (2-4 oraciones)", "findings": [{"severity": "high|medium|low", "file": "ruta", "comment": "hallazgo"}]}',
      "",
      "=== DIFF DEL MR ===",
      diff,
    ].join("\n");

    // ── Review con pi — cadena de fallback: zai → codex → openrouter ──
    // Solo errores de cuota/facturación disparan fallback; timeouts y otros
    // errores suben (son del review, no del proveedor).
    let piOut, usedLabel = PI_CHAIN[0].label;
    for (let i = 0; i < PI_CHAIN.length; i++) {
      const step = PI_CHAIN[i];
      usedLabel = step.label;
      try {
        const { stdout } = await run("pi", ["-p", "--mode", "json", ...step.args, "--thinking", "medium", prompt], {
          cwd: REPO_DIR,
          timeoutMs: PI_TIMEOUT_MS,
          env: { ...process.env, HOME: os.homedir() },
        });
        // Provider errors can be emitted as JSON events while pi exits 0.
        // Parse inside this try so quota errors also activate the fallback chain.
        piOut = parsePiOutput(stdout);
        break;
      } catch (e) {
        if (i === PI_CHAIN.length - 1 || !isQuotaError(e)) throw e;
        log(`pi falló por cuota en ${step.label}: ${errText(e)} — fallback a ${PI_CHAIN[i + 1].label}`);
      }
    }
    const review = safeJson(piOut.text);
    const verdict = normalizeVerdict(review.verdict);
    if (!verdict) throw new Error(`verdict inválido: ${JSON.stringify(review.verdict).slice(0, 100)}`);
    const findings = Array.isArray(review.findings) ? review.findings.slice(0, MAX_FINDINGS) : [];

    // ── Comentario final (se edita sobre el de inicio) ──
    const icon = verdict === "approve" ? "✅" : "⚠️";
    const title = verdict === "approve" ? "Aprobado" : "Cambios solicitados";
    const usageStr = piOut.usage
      ? ` · ${fmtK(piOut.usage.totalTokens)} tokens · $${(piOut.usage.cost?.total ?? 0).toFixed(4)}`
      : "";
    const modelStr = ` · \`${usedLabel}\``;
    const body = [
      `## 🤖 ${BOT_NAME} Review — ${icon} ${title}`,
      "",
      review.summary || "",
      "",
    ];
    if (findings.length) {
      body.push("**Hallazgos:**");
      for (const f of findings) {
        body.push(`- **[${f.severity || "low"}]** \`${f.file}\`: ${f.comment}`);
      }
      body.push("");
    }
    body.push(`---`, `<sub>${BOT_NAME}${modelStr} · revisado \`${sha.slice(0, 8)}\` · ${((Date.now() - t0) / 1000).toFixed(0)}s${usageStr} · el veredicto del agente es insumo: la decisión de mergear es humana</sub>`);
    await editNote(iid, startNote.id, body.join("\n"));

    // Fase de gate (THREADS_MODE=1, activo desde el A/B por pedido de Luis):
    // los findings son threads resolvibles → request_changes BLOQUEA el merge
    // hasta que Luis los resuelva (arreglando o marcando falso positivo).
    // Fail-safe: si el review falla, los threads viejos siguen bloqueando.
    if (THREADS_MODE) {
      await resolveBotThreads(iid); // push nuevo = hallazgos viejos invalidados
      if (verdict === "request_changes") {
        for (const f of findings) {
          await gitlab("POST", `/merge_requests/${iid}/discussions`, {
            body: `🤖 **[${f.severity || "low"}]** \`${f.file}\`: ${f.comment}`,
          }).catch(e => log("thread falló:", e.message));
        }
      }
    }

    state[iid] = { sha, verdict, reviewedAt: new Date().toISOString(), secs: ((Date.now() - t0) / 1000).toFixed(0) };
    saveState();
    log(`MR !${iid} revisado: ${verdict} (${state[iid].secs}s, ${findings.length} findings)`);
  }

  // ── PR-Agent (A/B Fase 1) — postea su propio review ("PR Reviewer Guide").
  // Además el receiver lleva un comentario de estado propio para atribución:
  // siempre queda claro quién revisó y en qué estado está.
  if (ENABLE_PR_AGENT && only !== "pi") {
    const paNote = await gitlab("POST", `/merge_requests/${iid}/notes`, {
      body: `🤖 PR-Agent Review (Qodo) — revisando… (\`${sha.slice(0, 8)}\`)`,
    });
    try {
      const { maxTok, via } = await runPrAgent(iid);
      const tokStr = maxTok ? ` · ~${fmtK(maxTok)} tokens de contexto` : "";
      const viaStr = via === "openrouter" ? " · fallback openrouter" : "";
      await editNote(iid, paNote.id,
        `🤖 PR-Agent Review (Qodo) — ✅ terminó: su review es el comentario **"PR Reviewer Guide 🔍"** de arriba (\`${sha.slice(0, 8)}\` · ${PR_AGENT_MODEL}${viaStr}${tokStr}).`);
    } catch (e) {
      await editNote(iid, paNote.id,
        `🤖 PR-Agent Review (Qodo) — ❌ falló: ${String(errText(e)).slice(0, 300)}`);
      log(`pr-agent falló en !${iid}:`, errText(e));
    }
  }
}

function prAgentCmd(iid, envFile) {
  return ["sudo", "-n", "-g", "docker", "docker", "run", "--rm",
    "--env-file", envFile,
    "pragent/pr-agent",
    "--pr_url", `https://gitlab.com/luga97/barbershop-saas/-/merge_requests/${iid}`,
    "review"];
}

async function runPrAgent(iid) {
  const t0 = Date.now();
  let stdout, via = "zai";
  try {
    ({ stdout } = await pexec("sudo", prAgentCmd(iid, PR_AGENT_ENV_FILE),
      { timeout: PR_AGENT_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }));
  } catch (e) {
    const txt = `${e.stderr || ""} ${e.message || ""}`;
    if (!QUOTA_RE.test(txt)) throw e;
    log(`pr-agent sin cuota zai — fallback a openrouter`);
    ({ stdout } = await pexec("sudo", prAgentCmd(iid, PR_AGENT_OPENROUTER_ENV),
      { timeout: PR_AGENT_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }));
    via = "openrouter";
  }
  const toks = [...String(stdout).matchAll(/Tokens?:?\s*([\d,]+)/g)].map(m => parseInt(m[1].replace(/,/g, "")));
  const maxTok = toks.length ? Math.max(...toks) : null;
  log(`pr-agent terminó !${iid} (${((Date.now() - t0) / 1000).toFixed(0)}s${maxTok ? `, contexto ~${fmtK(maxTok)} tokens` : ""}, via ${via})`);
  return { maxTok, via };
}

// ─── Threads ────────────────────────────────────────────────────────────────
const FINDING_PREFIX = "🤖 **[";

/** Resuelve los threads de findings abiertos del bot (invalidados por push nuevo
 *  o por un veredicto approve posterior). Los de Luis quedan como estén. */
async function resolveBotThreads(iid) {
  const discussions = await gitlab("GET", `/merge_requests/${iid}/discussions?per_page=100`);
  let n = 0;
  for (const d of discussions || []) {
    const note = d.notes?.[0];
    if (!note?.resolvable || note.resolved) continue;
    if (!note.author?.username.startsWith(`project_${PROJECT_ID}_bot`)) continue;
    if (!note.body.startsWith(FINDING_PREFIX)) continue;
    await gitlab("PUT", `/merge_requests/${iid}/discussions/${d.id}?resolved=true`)
      .then(() => n++).catch(e => log("resolve falló:", errText(e)));
  }
  if (n) log(`resueltos ${n} threads viejos del bot en !${iid}`);
}

// ─── Notas ──────────────────────────────────────────────────────────────────
async function editNote(iid, noteId, body) {
  return gitlab("PUT", `/merge_requests/${iid}/notes/${noteId}`, { body });
}

async function reportFailure(iid, sha, reason) {
  // Si el comentario de inicio existe de un intento fallido, editarlo; si no, crear uno.
  const notes = await gitlab("GET", `/merge_requests/${iid}/notes?per_page=10&sort=desc`);
  const mine = (notes || []).find(n =>
    n.author && n.author.username.startsWith(`project_${PROJECT_ID}_bot`)
    && n.body.includes(`${BOT_NAME} Review — revisando…`));
  const body = `🤖 ${BOT_NAME} Review — ❌ Review falló: ${String(reason).slice(0, 400)}`;
  if (mine) return editNote(iid, mine.id, body);
  return gitlab("POST", `/merge_requests/${iid}/notes`, { body });
}

// ─── HTTP ───────────────────────────────────────────────────────────────────
function verifyToken(req) {
  return crypto.timingSafeEqual(
    crypto.createHash("sha256").update(req.headers["x-gitlab-token"] || "").digest(),
    crypto.createHash("sha256").update(WEBHOOK_SECRET).digest(),
  );
}

function readBody(req, cb) {
  const chunks = [];
  req.on("data", c => chunks.push(c));
  req.on("end", () => cb(Buffer.concat(chunks).toString()));
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, working, queue: [...pending.keys()] }));
  }
  if (req.method === "POST" && req.url === "/retest") {
    return readBody(req, async raw => {
      if (!verifyToken(req)) { res.writeHead(403); return res.end(); }
      try {
        const { iid, only } = JSON.parse(raw || "{}");
        const mr = await gitlab("GET", `/merge_requests/${iid}`);
        if (mr.state !== "opened") throw new Error(`MR !${iid} no está abierto`);
        if (!only) { delete state[iid]; saveState(); }
        enqueue(iid, mr.sha, only);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, iid, sha: mr.sha, only: only || null }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: redact(String(e.message)).slice(0, 200) }));
      }
    });
  }
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(404); return res.end();
  }
  return readBody(req, raw => {
    if (!verifyToken(req)) { log("webhook con secreto inválido — ignorado"); res.writeHead(403); return res.end(); }
    res.writeHead(200); res.end("ok");
    try {
      const ev = JSON.parse(raw);
      if (ev.object_kind !== "merge_request") return;
      const oa = ev.object_attributes || {};
      const iid = oa.iid;
      const sha = oa.last_commit?.id;
      if (!iid || !sha) return;
      if (ev.project?.id !== PROJECT_ID) return;
      if (oa.work_in_progress) return log(`!${iid} es draft — skip`);
      if (oa.state_id !== undefined && oa.state_id !== 1) return log(`!${iid} no está abierto (state ${oa.state_id}) — skip`);
      const action = oa.action || "open";
      if (action === "update" && !oa.oldrev) return log(`!${iid} update sin commits (metadatos) — skip`);
      if (!["open", "reopen", "update"].includes(action)) return log(`!${iid} action=${action} — skip`);
      if (state[iid]?.sha === sha) return log(`!${iid} @ ${sha.slice(0, 8)} ya revisado — skip`);
      enqueue(iid, sha);
    } catch (e) {
      log("payload inválido:", e.message);
    }
  });
});

server.listen(PORT, "127.0.0.1", () => log(`receiver escuchando en 127.0.0.1:${PORT} (pr-agent: ${ENABLE_PR_AGENT ? "on" : "off"}, threads: ${THREADS_MODE ? "on" : "off"})`));
