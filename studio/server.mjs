/**
 * Stickman Studio - local render server.
 *
 *   npm run creator        ->  http://localhost:4321
 *
 * No framework, no build step: node:http serves the UI, a tiny JSON API and a
 * single-render job queue with SSE progress. Rendering itself is the existing
 * pipeline (script.json -> voiceover -> Remotion -> compress).
 */
import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import { buildScript, countWords, estimateSeconds, splitScript } from "./split.mjs";
import { probeDuration } from "../scripts/audio.mjs";

const STUDIO_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(STUDIO_DIR, "..");
const JOBS_DIR = path.join(STUDIO_DIR, "jobs");
const TMP_DIR = path.join(STUDIO_DIR, ".tmp");
const ENV_PATH = path.join(ROOT, ".env");
const REMOTION_CLI = path.join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js");

/* ------------------------------------------------------------------ env --- */

const loadEnv = async () => {
  try {
    const raw = await fs.readFile(ENV_PATH, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env yet */
  }
};

await loadEnv();
await fs.mkdir(JOBS_DIR, { recursive: true }).catch(() => {});
await fs.mkdir(TMP_DIR, { recursive: true }).catch(() => {});

const PORT = Number(process.env.STUDIO_PORT || 4321);
const LAN = process.env.STUDIO_LAN !== "0";
const PIN = (process.env.STUDIO_PIN || "").trim();
const HOST = LAN ? "0.0.0.0" : "127.0.0.1";

const settings = {
  apiKey: (process.env.ELEVENLABS_API_KEY || "").trim(),
  voice: (process.env.ELEVENLABS_VOICE_ID || "nPczCjzI2devNBz1zQrb").trim(), // Brian
  provider: (process.env.TTS_PROVIDER || "elevenlabs").trim(),
};

/* ---------------------------------------------------------------- helpers --- */

const log = (...args) => console.log("[studio]", ...args);

const json = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
};

const readBody = (req, limit = 2 * 1024 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const parseCookies = (header = "") =>
  Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const at = part.indexOf("=");
        return [part.slice(0, at), decodeURIComponent(part.slice(at + 1))];
      }),
  );

const lanUrls = () => {
  const urls = [];
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      urls.push({ name, url: `http://${address.address}:${PORT}` });
    }
  }
  return urls;
};

/* ------------------------------------------------------------------ jobs --- */

const jobs = new Map();
const queue = [];
let activeJob = null;
let jobCounter = 0;

const steps = [
  { id: "script", label: "Script" },
  { id: "voice", label: "Voice" },
  { id: "render", label: "Render" },
  { id: "publish", label: "Publish" },
];

const emit = (job, event) => {
  job.events.push(event);
  if (job.events.length > 300) job.events.splice(0, job.events.length - 300);
  for (const listener of job.listeners) {
    try {
      listener(event);
    } catch {
      /* client went away */
    }
  }
};

const publicJob = (job) => ({
  id: job.id,
  status: job.status,
  title: job.title,
  quality: job.quality,
  provider: job.provider,
  voice: job.voice,
  sceneCount: job.sceneCount,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  finishedAt: job.finishedAt,
  error: job.error,
  progress: job.progress,
  videoUrl: job.videoUrl,
  sizeBytes: job.sizeBytes,
  durationSeconds: job.durationSeconds,
  log: job.log.slice(-40),
});

const persist = async (job) => {
  try {
    const dir = path.join(JOBS_DIR, job.id);
    await fs.mkdir(dir, { recursive: true });
    const { listeners, events, child, ...rest } = job;
    await fs.writeFile(path.join(dir, "job.json"), `${JSON.stringify(rest, null, 2)}\n`);
    if (job.log.length > 0) {
      await fs.writeFile(path.join(dir, "log.txt"), `${job.log.join("\n")}\n`);
    }
  } catch (error) {
    log("could not persist job", job.id, error.message);
  }
};

const setStep = (job, stepId, percent, detail) => {
  const stepIndex = steps.findIndex((step) => step.id === stepId);
  job.progress = {
    step: stepId,
    stepIndex,
    steps: steps.map((step) => step.label),
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    detail: detail ?? "",
  };
  emit(job, { type: "progress", ...job.progress });
};

const appendLog = (job, line) => {
  const clean = line.replace(/\r/g, "").trimEnd();
  if (!clean) return;
  job.log.push(clean);
  if (job.log.length > 400) job.log.shift();
  emit(job, { type: "log", line: clean });
};

const killTree = (child) => {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-child.pid, "SIGKILL");
    }
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }
};

/**
 * Runs a child process, streaming output into the job log.
 * Resolves with { code, stdout } and never rejects on a non-zero exit.
 */
const runProcess = (job, command, args, { env = {}, timeoutMs = 60 * 60 * 1000, onLine } = {}) =>
  new Promise((resolve) => {
    if (job.cancelRequested) {
      resolve({ code: -1, stdout: "", cancelled: true });
      return;
    }

    const child = spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...env },
      shell: false,
      detached: process.platform !== "win32",
    });
    job.child = child;

    let stdout = "";
    let stderrTail = "";
    let buffer = "";

    const handle = (chunk) => {
      const text = chunk.toString();
      stdout += text;
      buffer += text;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (onLine) onLine(line);
      }
    };

    child.stdout.on("data", handle);
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderrTail = (stderrTail + text).slice(-4000);
      handle(chunk);
    });

    const timer = setTimeout(() => {
      appendLog(job, `! timeout after ${Math.round(timeoutMs / 1000)}s`);
      killTree(child);
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      job.child = null;
      resolve({ code: -1, stdout, error: error.message });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      job.child = null;
      if (buffer.trim().length > 0 && onLine) onLine(buffer);
      if (code !== 0) appendLog(job, `! exit ${code}: ${stderrTail.trim().split("\n").slice(-4).join(" | ")}`);
      resolve({ code, stdout, cancelled: Boolean(job.cancelRequested) });
    });
  });

const runNode = (job, scriptArgs, options) =>
  runProcess(job, process.execPath, scriptArgs, options);

const renderOne = async (job) => {
  job.status = "running";
  job.startedAt = new Date().toISOString();
  emit(job, { type: "status", status: job.status });
  await persist(job);

  const fail = async (message) => {
    job.status = "failed";
    job.error = message;
    job.finishedAt = new Date().toISOString();
    emit(job, { type: "status", status: job.status, error: message });
    setStep(job, job.progress?.step ?? "script", job.progress?.percent ?? 0, message);
    await persist(job);
  };

  try {
    /* 1. Script ------------------------------------------------------- */
    setStep(job, "script", 4, "validating scenes");

    let script;
    if (Array.isArray(job.scenes) && job.scenes.length > 0) {
      const base = buildScript(job.text || job.title || "Untitled", {
        title: job.title,
        voice: job.voice,
        provider: job.provider,
        speed: job.speed,
        heavy: job.heavy,
      }).script;
      script = { ...base, title: job.title || base.title, voice: job.voice || base.voice, scenes: job.scenes };
    } else {
      script = buildScript(job.text, {
        title: job.title,
        voice: job.voice,
        provider: job.provider,
        speed: job.speed,
        heavy: job.heavy,
      }).script;
    }

    job.sceneCount = script.scenes.length;

    const tempScript = path.join(TMP_DIR, `script-${job.id}.json`);
    await fs.writeFile(tempScript, `${JSON.stringify(script, null, 2)}\n`);

    const applied = await runNode(job, [path.join(ROOT, "scripts", "apply-script.mjs"), tempScript], {
      onLine: (line) => appendLog(job, line),
      timeoutMs: 60000,
    });
    if (applied.code !== 0) throw new Error("script validation failed - check the scene text");

    await fs.copyFile(path.join(ROOT, "public", "script.json"), path.join(JOBS_DIR, job.id, "script.json"));
    setStep(job, "script", 12, `${script.scenes.length} scenes`);

    /* 2. Voice -------------------------------------------------------- */
    setStep(job, "voice", 14, "generating narration");

    const total = script.scenes.length;
    let done = 0;
    const voice = await runNode(job, [path.join(ROOT, "scripts", "generate-voiceover.mjs")], {
      env: { ELEVENLABS_API_KEY: settings.apiKey },
      timeoutMs: 20 * 60 * 1000,
      onLine: (line) => {
        appendLog(job, line);
        if (/^\s*\d{2}\s+(created|cached)/.test(line)) {
          done += 1;
          setStep(job, "voice", 14 + (done / total) * 34, `voice ${Math.min(done, total)}/${total}`);
        }
      },
    });
    if (voice.cancelled) throw new Error("cancelled");
    if (voice.code !== 0) {
      const detail = [...job.log]
        .reverse()
        .find((line) => /voiceover generation failed|ElevenLabs \d{3}|not set|missing/i.test(line));
      throw new Error(
        detail
          ? detail.replace(/^.*?(failed:|error:)\s*/i, "").slice(0, 300)
          : "voice generation failed - see the log",
      );
    }

    setStep(job, "voice", 48, "narration ready");

    /* 3. Render ------------------------------------------------------- */
    setStep(job, "render", 50, "bundling project");

    const renderArgs = [
      REMOTION_CLI,
      "render",
      "StickmanExplainer",
      "out/video.mp4",
      "--log=info",
    ];
    if (job.quality === "draft") renderArgs.push("--scale=0.5");

    let lastPercent = 0;
    const render = await runNode(job, renderArgs, {
      timeoutMs: 60 * 60 * 1000,
      onLine: (line) => {
        appendLog(job, line);
        const bundle = line.match(/Bundling\s+(\d+)%/);
        if (bundle) {
          setStep(job, "render", 50 + Number(bundle[1]) * 0.05, `bundling ${bundle[1]}%`);
          return;
        }
        const rendered = line.match(/Rendered\s+(\d+)\/(\d+)/);
        if (rendered) {
          const percent = 56 + (Number(rendered[1]) / Math.max(1, Number(rendered[2]))) * 38;
          if (percent - lastPercent >= 1) {
            lastPercent = percent;
            const seconds = line.match(/time remaining:\s*(\d+)s/);
            setStep(
              job,
              "render",
              percent,
              `frame ${rendered[1]}/${rendered[2]}${seconds ? ` - ${seconds[1]}s left` : ""}`,
            );
          }
          return;
        }
        const encoded = line.match(/Encoded\s+(\d+)\/(\d+)/);
        if (encoded) {
          setStep(job, "render", 95, "encoding");
        }
      },
    });
    if (render.cancelled) throw new Error("cancelled");
    if (render.code !== 0) throw new Error("render failed - see the log");

    const renderedFile = path.join(ROOT, "out", "video.mp4");
    const stat = await fs.stat(renderedFile).catch(() => null);
    if (!stat || stat.size < 10_000) throw new Error("render produced no video");

    /* 4. Publish ------------------------------------------------------ */
    setStep(job, "publish", 96, "compressing");

    const compressed = await runNode(
      job,
      [path.join(ROOT, "scripts", "compress-if-needed.mjs"), renderedFile, "--max-mb=45"],
      { onLine: (line) => appendLog(job, line), timeoutMs: 10 * 60 * 1000 },
    );

    const outLine = compressed.stdout.split("\n").find((line) => line.startsWith("out="));
    const finalFile = outLine ? outLine.slice(4).trim() : renderedFile;

    const target = path.join(JOBS_DIR, job.id, "video.mp4");
    await fs.copyFile(finalFile, target);

    const finalStat = await fs.stat(target);
    job.sizeBytes = finalStat.size;
    job.durationSeconds = await probeDuration(target);
    job.videoUrl = `/jobs/${job.id}/video.mp4`;
    job.status = "done";
    job.finishedAt = new Date().toISOString();
    setStep(job, "publish", 100, "ready");
    emit(job, { type: "done", job: publicJob(job) });
    await persist(job);
    log(`job ${job.id} done`, `${(finalStat.size / 1024 / 1024).toFixed(1)} MB`);
  } catch (error) {
    if (job.cancelRequested) {
      job.status = "cancelled";
      job.finishedAt = new Date().toISOString();
      emit(job, { type: "status", status: job.status });
      await persist(job);
      return;
    }
    await fail(error?.message ?? String(error));
    log(`job ${job.id} failed:`, error?.message ?? error);
  } finally {
    job.child = null;
    await fs.rm(path.join(TMP_DIR, `script-${job.id}.json`), { force: true }).catch(() => {});
  }
};

const pump = () => {
  if (activeJob || queue.length === 0) return;
  const job = queue.shift();
  activeJob = job;
  renderOne(job)
    .catch((error) => log("job crashed", error))
    .finally(() => {
      activeJob = null;
      setImmediate(pump);
    });
};

const enqueue = (job) => {
  jobs.set(job.id, job);
  queue.push(job);
  job.status = "queued";
  const ahead = queue.length - 1 + (activeJob ? 1 : 0);
  emit(job, {
    type: "status",
    status: "queued",
    message: ahead > 0 ? `${ahead} render(s) ahead` : "starting",
  });
  persist(job);
  pump();
  return job;
};

const loadHistory = async () => {
  const entries = await fs.readdir(JOBS_DIR).catch(() => []);
  const dirs = [];
  for (const entry of entries) {
    const full = path.join(JOBS_DIR, entry);
    const stat = await fs.stat(full).catch(() => null);
    if (stat?.isDirectory()) dirs.push({ entry, mtime: stat.mtimeMs });
  }
  dirs.sort((a, b) => b.mtime - a.mtime);

  for (const { entry } of dirs.slice(0, 60)) {
    const file = path.join(JOBS_DIR, entry, "job.json");
    try {
      const data = JSON.parse(await fs.readFile(file, "utf8"));
      if (data.status === "running" || data.status === "queued") {
        data.status = "failed";
        data.error = data.error || "server restarted during render";
      }
      jobs.set(data.id, {
        ...data,
        events: [],
        listeners: new Set(),
        log: data.log ?? [],
      });
    } catch {
      /* skip broken job */
    }
  }
};

/* ------------------------------------------------------------------ http --- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
};

const serveFile = async (res, file, { download = false, req, filename } = {}) => {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat || !stat.isFile()) {
    json(res, 404, { error: "not found" });
    return;
  }

  const headers = {
    "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": file.includes(`${path.sep}jobs${path.sep}`) ? "private, max-age=3600" : "no-cache",
  };
  if (download) {
    headers["content-disposition"] = `attachment; filename="${filename ?? path.basename(file)}"`;
  }

  const range = req?.headers?.range;
  if (range && range.startsWith("bytes=")) {
    const [startRaw, endRaw] = range.slice(6).split("-");
    const start = Number.parseInt(startRaw || "0", 10);
    const end = endRaw ? Math.min(Number.parseInt(endRaw, 10), stat.size - 1) : stat.size - 1;
    if (Number.isNaN(start) || start > end) {
      res.writeHead(416, { "content-range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      ...headers,
      "content-range": `bytes ${start}-${end}/${stat.size}`,
      "content-length": end - start + 1,
    });
    fsSync.createReadStream(file, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, { ...headers, "content-length": stat.size });
  fsSync.createReadStream(file).pipe(res);
};

const authorized = (req) => {
  if (!PIN) return true;
  return parseCookies(req.headers.cookie).studio_pin === PIN;
};

const getElevenInfo = async ({ force = false } = {}) => {
  if (!settings.apiKey) return { ok: false, error: "no_api_key" };
  if (!force && elevenCache.at && Date.now() - elevenCache.at < 90_000) return elevenCache.data;
  try {
    const { getSubscription, listVoices } = await import("../scripts/tts/elevenlabs.mjs");
    const [subscription, voices] = await Promise.all([
      getSubscription(settings.apiKey),
      listVoices(settings.apiKey).catch(() => []),
    ]);
    const data = { ok: true, subscription, voices };
    elevenCache.at = Date.now();
    elevenCache.data = data;
    return data;
  } catch (error) {
    return { ok: false, error: error.message };
  }
};
const elevenCache = { at: 0, data: null };

const handleApi = async (req, res, url) => {
  const route = url.pathname;

  if (route === "/api/login" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    if (!PIN) return json(res, 200, { ok: true });
    if (String(body.pin ?? "") !== PIN) return json(res, 401, { ok: false, error: "wrong pin" });
    res.setHeader("set-cookie", `studio_pin=${encodeURIComponent(PIN)}; Path=/; Max-Age=31536000; SameSite=Lax`);
    return json(res, 200, { ok: true });
  }

  if (!authorized(req)) {
    return json(res, 401, { error: "pin_required" });
  }

  if (route === "/api/health") {
    const keyOk = Boolean(settings.apiKey);
    return json(res, 200, {
      ok: true,
      pinRequired: Boolean(PIN),
      apiKey: keyOk,
      provider: settings.provider,
      studio: { port: PORT, lan: LAN },
      urls: lanUrls(),
      jobs: { running: activeJob ? activeJob.id : null, queued: queue.length },
      platform: process.platform,
    });
  }

  if (route === "/api/voices") {
    const info = await getElevenInfo();
    const { EDGE_VOICES, ELEVEN_VOICES } = await import("../scripts/tts/index.mjs");
    return json(res, 200, {
      provider: settings.provider,
      apiKey: Boolean(settings.apiKey),
      defaultVoice: settings.voice,
      eleven: {
        builtin: ELEVEN_VOICES,
        account: info.ok ? info.voices : [],
        error: info.ok ? null : info.error,
      },
      edge: EDGE_VOICES,
      credits: info.ok ? info.subscription : null,
    });
  }

  if (route === "/api/credits") {
    return json(res, 200, await getElevenInfo({ force: true }));
  }

  if (route === "/api/split" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    try {
      const { title, scenes, stats } = splitScript(body.text ?? "", { title: body.title });
      return json(res, 200, { ok: true, title, scenes, stats });
    } catch (error) {
      return json(res, 400, { ok: false, error: error.message });
    }
  }

  if (route === "/api/estimate" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    return json(res, 200, {
      words: countWords(body.text ?? ""),
      seconds: Math.round(estimateSeconds(body.text ?? "") * 10) / 10,
    });
  }

  if (route === "/api/render" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const text = String(body.text ?? "").trim();
    const scenes = Array.isArray(body.scenes) ? body.scenes : null;
    if (text.length === 0 && !scenes) return json(res, 400, { error: "script is empty" });
    if (scenes && scenes.length === 0) return json(res, 400, { error: "no scenes" });

    if (!settings.apiKey && (body.provider ?? settings.provider) === "elevenlabs") {
      return json(res, 400, {
        error: "ElevenLabs key missing - Settings me key daalo ya Edge voice choose karo",
      });
    }

    jobCounter += 1;
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    const id = `${stamp}-${randomBytes(2).toString("hex")}`;

    const job = {
      id,
      status: "queued",
      title: String(body.title ?? "Untitled").slice(0, 120),
      quality: body.quality === "draft" ? "draft" : "final",
      provider: body.provider ?? settings.provider,
      voice: body.voice ?? settings.voice,
      speed: Number(body.speed ?? 0.92),
      heavy: body.heavy !== false,
      text,
      scenes,
      sceneCount: scenes?.length ?? 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      error: null,
      progress: { step: "script", stepIndex: 0, steps: steps.map((s) => s.label), percent: 0, detail: "queued" },
      videoUrl: null,
      sizeBytes: null,
      durationSeconds: null,
      log: [],
      events: [],
      listeners: new Set(),
      child: null,
      cancelRequested: false,
    };

    enqueue(job);
    log(`queued ${id} (${job.quality}, ${job.provider}, ${scenes?.length ?? "auto"} scenes)`);
    return json(res, 200, { ok: true, job: publicJob(job) });
  }

  if (route === "/api/jobs") {
    const list = [...jobs.values()]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 40)
      .map(publicJob);
    return json(res, 200, { jobs: list });
  }

  const jobMatch = route.match(/^\/api\/jobs\/([^/]+)(?:\/(events|cancel|reveal|delete))?$/);
  if (jobMatch) {
    const [, id, action] = jobMatch;
    const job = jobs.get(id);
    if (!job) return json(res, 404, { error: "job not found" });

    if (action === "events") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      res.write("retry: 2000\n\n");
      const send = (event) => {
        if (!res.writableEnded) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };
      send({ type: "snapshot", job: publicJob(job) });
      for (const event of job.events.slice(-120)) send(event);

      job.listeners.add(send);
      const heartbeat = setInterval(() => {
        if (!res.writableEnded) res.write(": ping\n\n");
      }, 15000);

      req.on("close", () => {
        clearInterval(heartbeat);
        job.listeners.delete(send);
      });
      return;
    }

    if (action === "cancel" && req.method === "POST") {
      job.cancelRequested = true;
      if (job.status === "queued") {
        const index = queue.indexOf(job);
        if (index >= 0) queue.splice(index, 1);
        job.status = "cancelled";
        job.finishedAt = new Date().toISOString();
        emit(job, { type: "status", status: job.status });
        await persist(job);
      } else if (job.child) {
        killTree(job.child);
      }
      return json(res, 200, { ok: true });
    }

    if (action === "reveal" && req.method === "POST") {
      const dir = path.join(JOBS_DIR, id);
      const opener =
        process.platform === "win32" ? ["explorer.exe", [dir]] : process.platform === "darwin" ? ["open", [dir]] : ["xdg-open", [dir]];
      try {
        spawn(opener[0], opener[1], { detached: true, stdio: "ignore" }).unref();
      } catch {
        /* headless */
      }
      return json(res, 200, { ok: true, dir });
    }

    if (action === "delete" && req.method === "POST") {
      if (job.child) return json(res, 400, { error: "job is running" });
      jobs.delete(id);
      await fs.rm(path.join(JOBS_DIR, id), { recursive: true, force: true }).catch(() => {});
      return json(res, 200, { ok: true });
    }

    return json(res, 200, { job: publicJob(job) });
  }

  if (route === "/api/settings") {
    if (req.method === "GET") {
      return json(res, 200, {
        apiKey: settings.apiKey ? `${settings.apiKey.slice(0, 6)}...${settings.apiKey.slice(-4)}` : "",
        hasKey: Boolean(settings.apiKey),
        voice: settings.voice,
        provider: settings.provider,
        pin: Boolean(PIN),
      });
    }

    if (req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (typeof body.apiKey === "string" && body.apiKey.trim() !== "") {
        settings.apiKey = body.apiKey.trim();
      }
      if (body.clearKey === true) settings.apiKey = "";
      if (typeof body.voice === "string" && body.voice.trim() !== "") settings.voice = body.voice.trim();
      if (typeof body.provider === "string" && body.provider.trim() !== "") settings.provider = body.provider.trim();

      const lines = [];
      try {
        lines.push(...(await fs.readFile(ENV_PATH, "utf8")).split(/\r?\n/));
      } catch {
        lines.push("# Stickman Studio - local only, never commit this file");
      }
      const setLine = (key, value) => {
        const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
        const line = `${key}=${value}`;
        if (index >= 0) lines[index] = line;
        else lines.push(line);
      };
      setLine("ELEVENLABS_API_KEY", settings.apiKey);
      setLine("ELEVENLABS_VOICE_ID", settings.voice);
      setLine("TTS_PROVIDER", settings.provider);
      await fs.writeFile(ENV_PATH, `${lines.filter((line, i) => line !== "" || i < lines.length - 1).join("\n").trim()}\n`);

      elevenCache.at = 0;
      const info = await getElevenInfo({ force: true });
      return json(res, 200, {
        ok: true,
        hasKey: Boolean(settings.apiKey),
        credits: info.ok ? info.subscription : null,
        error: info.ok ? null : info.error,
      });
    }
  }

  if (route === "/api/voice-test" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const text = String(body.text ?? "").trim().slice(0, 220);
    if (!text) return json(res, 400, { error: "text required" });
    if (!settings.apiKey) return json(res, 400, { error: "ElevenLabs key missing" });

    try {
      const { createProvider } = await import("../scripts/tts/index.mjs");
      const provider = createProvider({
        apiKey: settings.apiKey,
        provider: body.provider ?? "elevenlabs",
        voice: body.voice ?? settings.voice,
        rate: body.rate,
      });
      const result = await provider.synthesize(text);
      res.writeHead(200, { "content-type": "audio/mpeg", "content-length": result.audio.length });
      return res.end(result.audio);
    } catch (error) {
      return json(res, 500, { error: error.message });
    }
  }

  return json(res, 404, { error: "unknown endpoint" });
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      return await handleApi(req, res, url);
    }

    const jobFile = url.pathname.match(/^\/jobs\/([^/]+)\/(video\.mp4|script\.json)$/);
    if (jobFile) {
      const [, id, file] = jobFile;
      const target = path.join(JOBS_DIR, id, file);
      if (!target.startsWith(JOBS_DIR)) return json(res, 403, { error: "forbidden" });
      const job = jobs.get(id);
      const slug = (job?.title ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      const filename =
        file === "video.mp4" && slug ? `${slug}.mp4` : path.basename(file);
      return await serveFile(res, target, {
        req,
        download: url.searchParams.has("download"),
        filename,
      });
    }

    // The one-button cloud page, served from the same origin so it also works
    // from the phone while the PC is on.
    if (url.pathname === "/cloud" || url.pathname === "/cloud/" || url.pathname === "/cloud/index.html") {
      return await serveFile(res, path.join(ROOT, "cloud", "index.html"), { req });
    }

    const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!/^[\w.-]+$/.test(name)) return json(res, 404, { error: "not found" });
    const file = path.join(STUDIO_DIR, name);
    if (!file.startsWith(STUDIO_DIR)) return json(res, 403, { error: "forbidden" });
    if (name.endsWith(".json") && name === "package.json") return json(res, 404, { error: "not found" });

    return await serveFile(res, file, { req });
  } catch (error) {
    log("request failed", url.pathname, error?.message ?? error);
    if (!res.headersSent) json(res, 500, { error: error?.message ?? "server error" });
    else res.end();
  }
});

await loadHistory();

server.listen(PORT, HOST, () => {
  const local = `http://localhost:${PORT}`;
  log(`ready on ${local}`);
  for (const entry of lanUrls()) log(`phone (same wifi): ${entry.url}`);
  if (PIN) log("PIN protection is ON");
  if (!process.env.STUDIO_NO_OPEN && process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", local], { detached: true, stdio: "ignore" }).unref();
  }
});
