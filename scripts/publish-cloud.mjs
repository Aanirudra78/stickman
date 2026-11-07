/**
 * Publishes the phone page (`app/cloud/*`) to the small public repo that GitHub
 * Pages serves. The main `stickman` repo stays private; nothing secret is ever
 * copied here (the token lives in the phone's localStorage, not in the files).
 *
 *   npm run publish:cloud
 *
 * Credentials come from Git's credential helper, same as `git push`.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OWNER = process.env.CLOUD_OWNER ?? "Aanirudra78";
const SITE_REPO = process.env.CLOUD_REPO ?? "stickman-studio";
const BRANCH = "main";
const APP_DIR = path.join(import.meta.dirname, "..");
const SRC_DIR = path.join(APP_DIR, "cloud");
const WORK_DIR = path.join(APP_DIR, "studio", ".tmp", "cloud-site");
const FILES = ["index.html", "manifest.webmanifest", "icon.svg"];
const REMOTE = `https://github.com/${OWNER}/${SITE_REPO}.git`;
const PAGES_URL = `https://${OWNER.toLowerCase()}.github.io/${SITE_REPO}/`;

const log = (message) => console.log(`[cloud] ${message}`);

const run = (args, options = {}) => {
  const result = spawnSync("git", args, {
    cwd: options.cwd ?? APP_DIR,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.status !== 0 && !options.allowFail) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || "").trim()}`);
  }
  return result;
};

const token = () => {
  for (const value of [process.env.GH_TOKEN, process.env.GITHUB_TOKEN]) {
    if (value) return value;
  }
  const filled = spawnSync("git", ["-c", "credential.interactive=false", "credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const line = (filled.stdout || "").split(/\r?\n/).find((item) => item.startsWith("password="));
  return line ? line.slice("password=".length).trim() : null;
};

const github = async (route, options = {}) => {
  const secret = token();
  if (!secret) throw new Error("no GitHub token available");
  const response = await fetch(`https://api.github.com${route}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${secret}`,
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${route}: ${response.status} ${body.slice(0, 200)}`);
  return body ? JSON.parse(body) : null;
};

const ensureRepo = async () => {
  const probe = run(["ls-remote", REMOTE], { capture: true, allowFail: true });
  if (probe.status === 0) return;
  log(`creating public repo ${OWNER}/${SITE_REPO}`);
  await github("/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: SITE_REPO,
      description: "Phone page for the Stickman Studio cloud renderer",
      private: false,
      has_issues: false,
      has_wiki: false,
      auto_init: true,
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 2500));
};

const prepareWorkDir = () => {
  fs.mkdirSync(path.dirname(WORK_DIR), { recursive: true });
  if (fs.existsSync(path.join(WORK_DIR, ".git"))) {
    run(["fetch", "origin", BRANCH], { cwd: WORK_DIR });
    run(["checkout", BRANCH], { cwd: WORK_DIR });
    run(["reset", "--hard", `origin/${BRANCH}`], { cwd: WORK_DIR });
    return;
  }
  fs.rmSync(WORK_DIR, { recursive: true, force: true });
  run(["clone", "--depth", "1", "--branch", BRANCH, REMOTE, WORK_DIR], { cwd: APP_DIR });
};

const copyFiles = () => {
  for (const file of FILES) {
    const from = path.join(SRC_DIR, file);
    if (!fs.existsSync(from)) throw new Error(`missing source file: ${from}`);
    fs.copyFileSync(from, path.join(WORK_DIR, file));
  }
  const readme = [
    "# Stickman Cloud",
    "",
    "Phone page for the Stickman Studio cloud renderer.",
    "",
    `Live: ${PAGES_URL}`,
    "",
    "This repo only holds static UI. Renders run in the private",
    "`Aanirudra78/stickman` repo and are downloaded with a fine-grained token",
    "stored on the phone (never in this repo).",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(WORK_DIR, "README.md"), readme);
  fs.writeFileSync(path.join(WORK_DIR, ".nojekyll"), "");
};

const commitAndPush = () => {
  run(["add", "-A"], { cwd: WORK_DIR });
  const dirty = run(["status", "--porcelain"], { cwd: WORK_DIR, capture: true }).stdout.trim();
  if (!dirty) {
    log("already up to date");
    return false;
  }
  const localName = run(["config", "user.name"], { cwd: WORK_DIR, capture: true, allowFail: true }).stdout.trim();
  const localEmail = run(["config", "user.email"], { cwd: WORK_DIR, capture: true, allowFail: true }).stdout.trim();
  if (!localName) {
    const name =
      run(["config", "user.name"], { cwd: APP_DIR, capture: true, allowFail: true }).stdout.trim() || OWNER;
    run(["config", "user.name", name], { cwd: WORK_DIR });
  }
  if (!localEmail) {
    const email =
      run(["config", "user.email"], { cwd: APP_DIR, capture: true, allowFail: true }).stdout.trim() ||
      `${OWNER}@users.noreply.github.com`;
    run(["config", "user.email", email], { cwd: WORK_DIR });
  }
  run(["commit", "-m", "Publish phone page"], { cwd: WORK_DIR });
  run(["push", "origin", BRANCH], { cwd: WORK_DIR });
  return true;
};

const ensurePages = async () => {
  try {
    const current = await github(`/repos/${OWNER}/${SITE_REPO}/pages`);
    if (current?.build_type === "legacy" && current?.source?.branch === BRANCH) {
      log(`pages already serving ${current.source.path || "/"}`);
      return;
    }
  } catch (error) {
    if (!String(error.message).includes("404")) throw error;
  }
  await github(`/repos/${OWNER}/${SITE_REPO}/pages`, {
    method: "POST",
    body: JSON.stringify({ build_type: "legacy", source: { branch: BRANCH, path: "/" } }),
  });
  log("pages enabled");
};

const main = async () => {
  await ensureRepo();
  prepareWorkDir();
  copyFiles();
  const changed = commitAndPush();
  await ensurePages();
  if (changed) {
    log("waiting for Pages build (this can take ~40s)");
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const build = await github(`/repos/${OWNER}/${SITE_REPO}/pages/builds/latest`).catch(() => null);
      if (build?.status === "built") break;
      if (build?.status === "errored") throw new Error(`pages build errored: ${build.error?.message ?? ""}`);
    }
  }
  log(`live: ${PAGES_URL}`);
};

main().catch((error) => {
  console.error(`[cloud] ${error.message}`);
  process.exit(1);
});
