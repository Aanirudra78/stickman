const $ = (selector) => document.querySelector(selector);

const POSES = [
  "idle", "talking", "pointing", "thinking", "surprised", "happy",
  "sad_slouch", "angry_fists", "confused_scratch", "scared_back", "proud_chest",
  "excited_bounce", "listening_tilt", "nodding", "tired_sigh", "facepalm",
  "explaining_up", "counting_fingers", "leaning_back", "victory_arms",
];
const WPS = 2.6;

const state = {
  scenes: [],
  title: "",
  quality: "final",
  provider: "elevenlabs",
  voice: null,
  speed: 0.92,
  heavy: true,
  jobId: null,
  eventSource: null,
  health: null,
  lastJob: null,
};

/* ------------------------------------------------------------- helpers --- */

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const escapeAttr = (value) => escapeHtml(value).replaceAll('"', "&quot;");

const countWords = (text) => (String(text ?? "").match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019-]*/gu) ?? []).length;

const estimateSeconds = (text) => Math.max(1.6, countWords(text) / WPS + 0.5);

const formatSeconds = (value) => {
  if (!value || !Number.isFinite(value)) return "–";
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const formatBytes = (value) => {
  if (!value) return "";
  const mb = value / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
};

const formatDate = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

let toastTimer;
const toast = (message, isError = false) => {
  const element = $("#toast");
  element.textContent = message;
  element.classList.toggle("err", isError);
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.hidden = true;
  }, isError ? 6000 : 3200);
};

const setStateChip = (text, kind = "") => {
  $("#state-text").textContent = text;
  const dot = $("#state-chip .dot");
  dot.className = `dot ${kind}`;
};

const api = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(path, {
      headers: { "content-type": "application/json" },
      ...options,
    });
  } catch {
    setStateChip("server offline", "err");
    throw new Error("Cannot reach the Studio server on this machine.");
  }

  if (response.status === 401) {
    showPin();
    throw new Error("PIN required");
  }

  const type = response.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error((data && data.error) || `HTTP ${response.status}`);
  }
  return data;
};

/* ----------------------------------------------------------------- pin --- */

const showPin = () => {
  $("#pin-screen").hidden = false;
  setTimeout(() => $("#pin-input").focus(), 50);
};

$("#pin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const pin = $("#pin-input").value.trim();
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (response.ok) {
      location.reload();
      return;
    }
  } catch {
    toast("Studio server unreachable", true);
  }
  $("#pin-error").hidden = false;
});

/* ------------------------------------------------------------ composer --- */

const scriptInput = $("#script-input");
const titleInput = $("#title-input");

const updateEstimate = () => {
  const words = countWords(scriptInput.value);
  if (words === 0) {
    $("#estimate").textContent = "";
    return;
  }
  const seconds = Math.round(estimateSeconds(scriptInput.value));
  $("#estimate").textContent = `${words} words · ~${seconds}s`;
  $("#estimate").style.color = seconds > 75 ? "var(--err)" : "";
};

let saveTimer;
const saveDraft = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem("studio.draft", scriptInput.value);
      localStorage.setItem("studio.title", titleInput.value);
      localStorage.setItem("studio.scenes", JSON.stringify(state.scenes));
    } catch {
      /* private mode */
    }
  }, 400);
};

scriptInput.addEventListener("input", () => {
  updateEstimate();
  saveDraft();
});
titleInput.addEventListener("input", saveDraft);

/* -------------------------------------------------------------- scenes --- */

const scenesEl = $("#scenes");

const sceneCard = (scene, index) => `
  <div class="scene" data-index="${index}">
    <div class="scene-top">
      <span class="scene-index">${index + 1}</span>
      <select data-field="scene_type" title="Scene type">
        <option value="text"${scene.scene_type === "text" ? " selected" : ""}>text</option>
        <option value="points"${scene.scene_type === "points" ? " selected" : ""}>points</option>
      </select>
      <select data-field="pose" title="Pose">
        ${POSES.map((pose) => `<option value="${pose}"${scene.pose === pose ? " selected" : ""}>${pose}</option>`).join("")}
      </select>
      <span class="spacer"></span>
      <button type="button" class="remove" data-action="remove" title="Delete scene">✕</button>
    </div>
    <label>
      <span>Caption on screen</span>
      <input type="text" data-field="text" value="${escapeAttr(scene.text)}" />
    </label>
    <label>
      <span>Voiceover</span>
      <textarea data-field="voiceover" rows="2">${escapeHtml(scene.voiceover)}</textarea>
    </label>
    ${
      scene.scene_type === "points"
        ? `<label><span>Points (one per line)</span><textarea data-field="items" rows="3">${escapeHtml((scene.items ?? []).join("\n"))}</textarea></label>`
        : ""
    }
    ${sceneActChips(scene)}
    <div class="scene-foot">
      <span class="muted"></span>
      <label style="flex-direction: row; align-items: center; gap: 6px">
        <span>min</span>
        <input type="number" data-field="duration" min="0.5" step="0.1" value="${scene.duration}" />
      </label>
    </div>
  </div>`;

/** What the stickman will actually do in this scene (auto-detected). */
const sceneActChips = (scene) => {
  const actions = (scene.actions ?? []).map(
    (action, chipIndex) =>
      `<span class="act-chip action">${escapeHtml(String(action.at))}s ${escapeHtml(action.id)}<button type="button" data-action="drop-action" data-i="${chipIndex}" title="Remove action">✕</button></span>`,
  );
  const props = (scene.props ?? []).map(
    (prop, chipIndex) =>
      `<span class="act-chip prop">${escapeHtml(prop)}<button type="button" data-action="drop-prop" data-i="${chipIndex}" title="Remove prop">✕</button></span>`,
  );
  const guest = scene.guest
    ? `<span class="act-chip guest">guest: ${escapeHtml(scene.guest.name)}<button type="button" data-action="drop-guest" title="Remove guest">✕</button></span>`
    : "";

  const chips = [...actions, ...props, guest].filter(Boolean);
  if (chips.length === 0) {
    return `<div class="scene-acts"><span class="none">No acting yet — Auto-split detects actions</span></div>`;
  }
  return `<div class="scene-acts">${chips.join("")}</div>`;
};

const updateSceneStats = (card, scene) => {
  const label = card.querySelector(".scene-foot .muted");
  if (label) {
    label.textContent = `${countWords(scene.voiceover)} words · ~${Math.round(estimateSeconds(scene.voiceover))}s`;
  }
};

const renderScenes = () => {
  scenesEl.innerHTML = state.scenes.map(sceneCard).join("");
  scenesEl.querySelectorAll(".scene").forEach((card) => {
    const index = Number(card.dataset.index);
    updateSceneStats(card, state.scenes[index]);
  });
  updateSummary();
};

const updateSummary = () => {
  const seconds = state.scenes.reduce((sum, scene) => sum + estimateSeconds(scene.voiceover), 0);
  $("#scene-summary").textContent = state.scenes.length
    ? `${state.scenes.length} scenes · ~${Math.round(seconds)}s`
    : "";
  $("#scene-summary").style.color = seconds > 75 ? "var(--err)" : "";
};

scenesEl.addEventListener("input", (event) => {
  const card = event.target.closest(".scene");
  if (!card) return;
  const index = Number(card.dataset.index);
  const scene = state.scenes[index];
  const field = event.target.dataset.field;
  if (!scene || !field) return;

  if (field === "items") {
    scene.items = event.target.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } else if (field === "duration") {
    const value = Number(event.target.value);
    scene.duration = Number.isFinite(value) && value > 0 ? value : scene.duration;
  } else {
    scene[field] = event.target.value;
  }

  updateSceneStats(card, scene);
  updateSummary();
  saveDraft();
});

scenesEl.addEventListener("change", (event) => {
  const card = event.target.closest(".scene");
  if (!card) return;
  const index = Number(card.dataset.index);
  const field = event.target.dataset.field;
  if (field === "scene_type") {
    state.scenes[index].scene_type = event.target.value;
    if (event.target.value === "points" && !state.scenes[index].items?.length) {
      state.scenes[index].items = [state.scenes[index].text || "Point one"];
    }
    renderScenes();
    saveDraft();
  }
  if (field === "pose") {
    state.scenes[index].pose = event.target.value;
    saveDraft();
  }
});

scenesEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest(".scene");
  if (!card) return;
  const index = Number(card.dataset.index);
  const scene = state.scenes[index];
  if (!scene) return;

  switch (button.dataset.action) {
    case "remove":
      state.scenes.splice(index, 1);
      break;
    case "drop-action":
      scene.actions?.splice(Number(button.dataset.i), 1);
      break;
    case "drop-prop":
      scene.props?.splice(Number(button.dataset.i), 1);
      break;
    case "drop-guest":
      delete scene.guest;
      break;
    default:
      return;
  }

  renderScenes();
  saveDraft();
});

$("#add-scene").addEventListener("click", () => {
  state.scenes.push({
    text: "New scene",
    voiceover: "",
    pose: "talking",
    scene_type: "text",
    duration: 2,
    speaking: false,
  });
  renderScenes();
  saveDraft();
});

/* --------------------------------------------------------------- split --- */

$("#split-btn").addEventListener("click", async () => {
  const text = scriptInput.value.trim();
  if (!text) return toast("Pehle script paste karo", true);

  const button = $("#split-btn");
  button.disabled = true;
  button.textContent = "Splitting…";

  try {
    const data = await api("/api/split", {
      method: "POST",
      body: JSON.stringify({ text, title: titleInput.value.trim() || undefined }),
    });

    state.scenes = data.scenes;
    state.title = data.title;
    if (!titleInput.value.trim()) titleInput.value = data.title;

    renderScenes();
    $("#scenes-card").hidden = false;
    $("#render-card").hidden = false;

    const warnings = data.stats?.warnings ?? [];
    $("#split-warnings").innerHTML = warnings
      .map((warning) => `<div class="warning">${escapeHtml(warning)}</div>`)
      .join("");

    $("#scenes-card").scrollIntoView({ behavior: "smooth", block: "start" });
    toast(`${data.scenes.length} scenes ready`);
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Auto-split →";
  }
});

/* -------------------------------------------------------------- voices --- */

const voiceSelect = $("#voice-select");

const loadVoices = async () => {
  try {
    const data = await api("/api/voices");
    state.provider = data.provider === "edge" ? "edge" : "elevenlabs";

    const options = [];
    const builtinIds = new Set(data.eleven.builtin.map((voice) => voice.id));
    if (data.eleven.builtin.length > 0) {
      options.push(`<optgroup label="ElevenLabs · deep & storytelling">`);
      for (const voice of data.eleven.builtin) {
        options.push(
          `<option value="elevenlabs|${voice.id}">${escapeHtml(voice.name)}${voice.paid ? " · paid plan" : ""}</option>`,
        );
      }
      options.push("</optgroup>");
    }
    const accountVoices = data.eleven.account.filter((voice) => !builtinIds.has(voice.id));
    if (accountVoices.length > 0) {
      options.push(`<optgroup label="ElevenLabs · your account">`);
      for (const voice of accountVoices) {
        options.push(
          `<option value="elevenlabs|${voice.id}">${escapeHtml(voice.name)}${voice.category ? ` · ${voice.category}` : ""}</option>`,
        );
      }
      options.push("</optgroup>");
    }
    options.push(`<optgroup label="Edge TTS · free, no key">`);
    for (const voice of data.edge) {
      options.push(`<option value="edge|${voice.id}">${escapeHtml(voice.name)}</option>`);
    }
    options.push("</optgroup>");

    voiceSelect.innerHTML = options.join("");
    const preferred =
      state.provider === "edge" || !data.apiKey
        ? `edge|${data.edge[0]?.id}`
        : `elevenlabs|${data.defaultVoice}`;
    voiceSelect.value = preferred;
    applyVoiceSelection();

    if (!data.apiKey) {
      setStateChip("edge mode", "");
    }

    if (data.credits) {
      const chip = $("#credits-chip");
      chip.hidden = false;
      const remaining = Math.max(0, data.credits.limit - data.credits.used);
      chip.textContent = `${remaining.toLocaleString()} chars left`;
      chip.title = `${data.credits.tier} plan · resets ${data.credits.resetsAt ?? "monthly"}`;
    }
  } catch (error) {
    console.warn("voices", error);
  }
};

const applyVoiceSelection = () => {
  const [provider, ...rest] = voiceSelect.value.split("|");
  state.provider = provider;
  state.voice = rest.join("|");
};

const loadCredits = async () => {
  try {
    const data = await api("/api/credits");
    if (!data.ok || !data.subscription) return;
    const chip = $("#credits-chip");
    chip.hidden = false;
    const remaining = Math.max(0, data.subscription.limit - data.subscription.used);
    chip.textContent = `${remaining.toLocaleString()} chars left`;
    chip.title = `${data.subscription.tier} plan · resets ${data.subscription.resetsAt ?? "monthly"}`;
  } catch {
    /* no key or offline */
  }
};

voiceSelect.addEventListener("change", () => {
  applyVoiceSelection();
  saveDraft();
});

loadCredits();

/* ------------------------------------------------------- render controls --- */

const speedInput = $("#speed");
speedInput.addEventListener("input", () => {
  state.speed = Number(speedInput.value);
  $("#speed-out").textContent = state.speed.toFixed(2);
});

$("#quality").addEventListener("click", (event) => {
  const button = event.target.closest("[data-quality]");
  if (!button) return;
  state.quality = button.dataset.quality;
  $("#quality").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  $("#render-hint").textContent =
    state.quality === "draft"
      ? "Draft ~1–2 min (540×960) · idea check karne ke liye."
      : "Final ~5–8 min (1080×1920, 30fps).";
});

$("#heavy").addEventListener("change", (event) => {
  state.heavy = event.target.checked;
});

$("#voice-test").addEventListener("click", async () => {
  const button = $("#voice-test");
  const text = (state.scenes[0]?.voiceover || scriptInput.value || "This is how it sounds.").slice(0, 180);
  button.disabled = true;
  button.textContent = "● generating…";
  try {
    const response = await fetch("/api/voice-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, provider: state.provider, voice: state.voice }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.play();
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "▶ Test voice";
  }
});

/* --------------------------------------------------------------- render --- */

const cleanScene = (scene) => ({
  text: String(scene.text ?? "").trim(),
  voiceover: String(scene.voiceover ?? "").trim(),
  pose: scene.pose,
  scene_type: scene.scene_type,
  duration: Number(scene.duration) || 2,
  // Lip sync only for the talking pose (same default the renderer uses).
  speaking: scene.pose === "talking",
  ...(scene.scene_type === "points" ? { items: (scene.items ?? []).filter(Boolean) } : {}),
  // Carrying the detected acting through is what makes the render match the
  // chips the user is looking at.
  ...(Array.isArray(scene.actions) && scene.actions.length > 0
    ? {
        actions: scene.actions.map((action) => ({
          at: Number(action.at) || 0,
          // The word index is what locks the gesture to the narration; dropping
          // it here was why the phone render drifted from the storyboard.
          ...(Number.isInteger(action.word) && action.word >= 0
            ? { word: action.word }
            : {}),
          id: action.id,
        })),
      }
    : {}),
  ...(Array.isArray(scene.props) && scene.props.length > 0
    ? { props: scene.props.slice(0, 2) }
    : {}),
  // Spread keeps `word`, so the cameo also enters on the spoken name.
  ...(scene.guest ? { guest: { ...scene.guest } } : {}),
});

$("#render-btn").addEventListener("click", async () => {
  if (state.scenes.length === 0) return toast("Pehle auto-split karo", true);

  const invalid = state.scenes.find(
    (scene) => !String(scene.voiceover ?? "").trim() || (scene.scene_type === "points" && !(scene.items ?? []).length),
  );
  if (invalid) return toast("Har scene me voiceover hona chahiye (points me items bhi)", true);

  const button = $("#render-btn");
  button.disabled = true;
  button.textContent = "Starting…";

  try {
    const data = await api("/api/render", {
      method: "POST",
      body: JSON.stringify({
        text: scriptInput.value.trim(),
        title: titleInput.value.trim() || state.title,
        scenes: state.scenes.map(cleanScene),
        quality: state.quality,
        provider: state.provider,
        voice: state.voice,
        speed: state.speed,
        heavy: state.heavy,
      }),
    });

    state.jobId = data.job.id;
    showProgress(data.job);
    connect(data.job.id);
    toast("Render queued");
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Render video";
  }
});

/* ------------------------------------------------------------- progress --- */

const showProgress = (job) => {
  $("#progress-card").hidden = false;
  $("#result-card").hidden = true;
  setStateChip("rendering", "busy");
  renderProgress(job.progress ?? { stepIndex: 0, steps: ["Script", "Voice", "Render", "Publish"], percent: 0, detail: "queued" });
  $("#log").textContent = "";
  $("#progress-card").scrollIntoView({ behavior: "smooth", block: "center" });
};

const renderProgress = (progress) => {
  const steps = progress.steps ?? ["Script", "Voice", "Render", "Publish"];
  const current = progress.stepIndex ?? 0;
  $("#steps").innerHTML = steps
    .map(
      (label, index) =>
        `<span class="step ${index < current ? "done" : index === current ? "active" : ""}"><i class="bullet"></i>${escapeHtml(label)}</span>`,
    )
    .join("");
  $("#bar-fill").style.width = `${Math.max(2, progress.percent ?? 0)}%`;
  $("#progress-detail").textContent = progress.detail || `${progress.percent ?? 0}%`;
};

const appendLog = (line) => {
  const element = $("#log");
  element.textContent += `${line}\n`;
  const lines = element.textContent.split("\n");
  if (lines.length > 200) element.textContent = lines.slice(-200).join("\n");
  element.scrollTop = element.scrollHeight;
};

const connect = (jobId) => {
  if (state.eventSource) state.eventSource.close();
  const source = new EventSource(`/api/jobs/${jobId}/events`);
  state.eventSource = source;

  source.addEventListener("snapshot", (event) => {
    const { job } = JSON.parse(event.data);
    if (job.status === "done") finishJob(job);
    else if (job.status === "failed") failJob(job);
    else if (job.status === "running" || job.status === "queued") showProgress(job);
  });

  source.addEventListener("status", (event) => {
    const data = JSON.parse(event.data);
    if (data.status === "failed") failJob({ id: jobId, error: data.error, progress: { detail: data.error } });
  });

  source.addEventListener("progress", (event) => {
    renderProgress(JSON.parse(event.data));
  });

  source.addEventListener("log", (event) => {
    appendLog(JSON.parse(event.data).line);
  });

  source.addEventListener("done", (event) => {
    finishJob(JSON.parse(event.data).job);
  });

  source.addEventListener("error", () => {
    if (source.readyState === EventSource.CLOSED) return;
    setStateChip("reconnecting", "busy");
  });
};

const finishJob = (job) => {
  state.lastJob = job;
  state.jobId = job.id;
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }

  setStateChip("ready", "ok");
  renderProgress({ stepIndex: 3, steps: ["Script", "Voice", "Render", "Publish"], percent: 100, detail: "ready" });

  $("#result-card").hidden = false;
  const player = $("#player");
  player.src = job.videoUrl;
  player.load();

  $("#download-btn").href = `${job.videoUrl}?download=1`;
  $("#result-meta").textContent =
    `${formatSeconds(job.durationSeconds)} · ${formatBytes(job.sizeBytes)} · ${job.quality}`;

  $("#result-card").scrollIntoView({ behavior: "smooth", block: "center" });
  toast("Video ready");
  loadHistory();
};

const failJob = (job) => {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  setStateChip("error", "err");
  $("#progress-detail").textContent = job.error || "render failed";
  toast(job.error || "Render failed — log dekho", true);
  loadHistory();
};

$("#cancel-btn").addEventListener("click", async () => {
  if (!state.jobId) return;
  try {
    await api(`/api/jobs/${state.jobId}/cancel`, { method: "POST" });
    toast("Cancelling…");
  } catch (error) {
    toast(error.message, true);
  }
});

$("#folder-btn").addEventListener("click", async () => {
  if (!state.jobId) return;
  try {
    await api(`/api/jobs/${state.jobId}/reveal`, { method: "POST" });
  } catch (error) {
    toast(error.message, true);
  }
});

/* -------------------------------------------------------------- history --- */

const loadHistory = async () => {
  try {
    const data = await api("/api/jobs");
    const jobs = data.jobs ?? [];
    $("#history-card").hidden = jobs.length === 0;
    $("#history").innerHTML = jobs
      .map(
        (job) => `
        <div class="history-item" data-id="${job.id}">
          <div class="meta">
            <strong>${escapeHtml(job.title || "Untitled")}</strong>
            <span>${formatDate(job.createdAt)} · ${job.quality} · ${job.sceneCount || "?"} scenes${
              job.durationSeconds ? ` · ${formatSeconds(job.durationSeconds)}` : ""
            }</span>
          </div>
          <span class="badge ${job.status}">${job.status}</span>
        </div>`,
      )
      .join("");
  } catch (error) {
    console.warn("history", error);
  }
};

$("#refresh-history").addEventListener("click", loadHistory);

$("#history").addEventListener("click", async (event) => {
  const item = event.target.closest(".history-item");
  if (!item) return;
  try {
    const data = await api(`/api/jobs/${item.dataset.id}`);
    const job = data.job;
    if (job.status === "done") {
      finishJob(job);
    } else if (job.status === "running" || job.status === "queued") {
      state.jobId = job.id;
      showProgress(job);
      connect(job.id);
    } else {
      toast(`Job ${job.status}${job.error ? `: ${job.error}` : ""}`, true);
    }
  } catch (error) {
    toast(error.message, true);
  }
});

/* ------------------------------------------------------------- settings --- */

const dialog = $("#settings-dialog");

$("#settings-btn").addEventListener("click", async () => {
  try {
    const data = await api("/api/settings");
    $("#settings-key").value = "";
    $("#settings-key").placeholder = data.hasKey ? `${data.apiKey} (saved)` : "sk_...";
    $("#settings-credits").textContent = data.hasKey ? "" : "Key ke bina Edge voices chalengi (free).";
  } catch {
    /* pin screen already shown */
  }
  renderQr();
  dialog.showModal();
});

$("#settings-save").addEventListener("click", async () => {
  const key = $("#settings-key").value.trim();
  try {
    const data = await api("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        ...(key ? { apiKey: key } : {}),
        provider: state.provider,
        voice: state.voice,
      }),
    });
    if (data.credits) {
      const remaining = Math.max(0, data.credits.limit - data.credits.used);
      $("#settings-credits").textContent = `${remaining.toLocaleString()} characters left this month`;
    } else if (data.error) {
      $("#settings-credits").textContent = data.error;
    }
    toast("Settings saved");
    await loadVoices();
    loadHistory();
  } catch (error) {
    toast(error.message, true);
  }
});

$("#settings-clear").addEventListener("click", async () => {
  try {
    await api("/api/settings", { method: "POST", body: JSON.stringify({ clearKey: true }) });
    toast("Key removed — Edge voices active");
    await loadVoices();
  } catch (error) {
    toast(error.message, true);
  }
});

const renderQr = () => {
  const urls = state.health?.urls ?? [];
  const entry = urls.find((item) => /wi-?fi|wlan|ethernet/i.test(item.name)) ?? urls[0];
  if (!entry) {
    $("#qr-row").hidden = true;
    return;
  }
  const url = entry.url;
  $("#qr-row").hidden = false;
  $("#qr-url").textContent = url;
  $("#qr-img").src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(url)}`;
};

/* ------------------------------------------------------------------ pwa --- */

let installEvent = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installEvent = event;
  $("#install-btn").hidden = false;
});

$("#install-btn").addEventListener("click", async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $("#install-btn").hidden = true;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

/* ------------------------------------------------------ scene overrides --- */

const overridesState = {
  loaded: false,
  busy: false,
  data: null, // GET /api/scenes response
};

const overrideRow = (scene, index) => {
  const catalog = overridesState.data;
  const voice = catalog.voices[index];
  const action = scene.actions?.[0];
  const propOptions = (selected) =>
    `<option value=""${selected ? "" : " selected"}>(no prop)</option>` +
    catalog.propIds
      .map(
        (id) => `<option value="${escapeAttr(id)}"${selected === id ? " selected" : ""}>${escapeHtml(id)}</option>`,
      )
      .join("");
  const actionOptions =
    '<option value="">(hold only)</option>' +
    catalog.actionIds
      .map(
        (id) => `<option value="${escapeAttr(id)}"${action?.id === id ? " selected" : ""}>${escapeHtml(id)}</option>`,
      )
      .join("");

  return `
  <div class="override-row" data-index="${index}">
    <span class="ov-index">${index + 1}</span>
    <div class="ov-main">
      <label class="ov-label"><span>Script pe caption</span>
        <input data-apply="text" value="${escapeAttr(scene.text)}" />
      </label>
      <label class="ov-label"><span>Narration (bolne wali line)</span>
        <textarea data-apply="voiceover" rows="1">${escapeHtml(scene.voiceover)}</textarea>
      </label>
    </div>
    <div class="ov-acts">
      <label class="ov-label"><span>Action</span>
        <select data-apply="action">${actionOptions}</select>
      </label>
      <label class="ov-label"><span>Word #</span>
        <input data-apply="word" type="number" min="0" step="1" value="${action?.word ?? 1}" />
      </label>
      <label class="ov-label"><span>Prop</span>
        <select data-apply="prop">${propOptions(scene.props?.[0])}</select>
      </label>
      <label class="ov-label"><span>2nd prop</span>
        <select data-apply="prop2">${propOptions(scene.props?.[1])}</select>
      </label>
      <label class="ov-label"><span>Guest</span>
        <input data-apply="guest" placeholder="(no guest)" value="${escapeAttr(scene.guest?.name ?? "")}" />
      </label>
    </div>
    <div class="ov-side">
      <button type="button" class="ghost tiny" data-ov="regen" title="Generate this line's voice and play it">♪ <span>${escapeHtml(voice ? `${voice.durationInSeconds?.toFixed?.(1) ?? "?"}s` : "gen + play")}</span></button>
    </div>
  </div>`;
};

const renderOverrides = () => {
  const catalog = overridesState.data;
  $("#overrides").innerHTML = catalog.scenes
    .map((scene, index) => overrideRow(scene, index))
    .join("");
  $("#overrides-summary").textContent = `${catalog.scenes.length} scenes · voice: ${catalog.tts?.voice ?? catalog.voice ?? "?"}`;
};

const loadOverrides = async () => {
  try {
    overridesState.data = await api("/api/scenes");
    overridesState.loaded = true;
    $("#overrides-card").hidden = false;
    renderOverrides();
  } catch (error) {
    toast(`Overrides load failed: ${error.message}`, true);
  }
};

$("#overrides-btn").addEventListener("click", () => {
  if (!overridesState.loaded) loadOverrides();
  $("#overrides-card").hidden = !overridesState.loaded;
  if (overridesState.loaded) {
    $("#overrides-card").scrollIntoView({ behavior: "smooth" });
  }
});

$("#overrides-refresh").addEventListener("click", async () => {
  if (overridesState.busy) return;
  await loadOverrides();
});

$("#overrides").addEventListener("change", async (event) => {
  const field = event.target.dataset.apply;
  if (!field) return;
  const row = event.target.closest(".override-row");
  const index = Number(row.dataset.index);
  const patch = {};
  if (field === "action" || field === "prop" || field === "prop2" || field === "guest") {
    patch[field] = event.target.value;
  } else if (field === "word") {
    patch.word = Number(event.target.value) || 0;
  } else if (field === "text" || field === "voiceover") {
    patch[field] = event.target.value;
  }
  try {
    const result = await api(`/api/scene/${index}`, { method: "PATCH", body: JSON.stringify(patch) });
    // Re-render just this row's data (the server normalises word/at/guest).
    overridesState.data.scenes[index] = result.scene;
    row.outerHTML = overrideRow(result.scene, index);
    toast(`Scene ${index + 1} saved`, false);
  } catch (error) {
    toast(`Save failed: ${error.message}`, true);
    loadOverrides();
  }
});

$("#overrides").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-ov='regen']");
  if (!button) return;
  if (overridesState.busy) {
    toast("Ek line pehle generate ho rahi hai...", true);
    return;
  }
  const row = button.closest(".override-row");
  const index = Number(row.dataset.index);
  overridesState.busy = true;
  button.disabled = true;
  button.textContent = "…generating";
  try {
    const response = await fetch(`/api/scene/${index}/regen-voice`, { method: "POST" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const audioPlayer = new Audio(URL.createObjectURL(blob));
    await audioPlayer.play().catch(() => {});
    const refreshed = await api("/api/scenes");
    overridesState.data = refreshed;
    row.outerHTML = overrideRow(refreshed.scenes[index], index);
    toast(`Scene ${index + 1} voice regenerated`);
  } catch (error) {
    toast(`Regen failed: ${error.message}`, true);
  } finally {
    overridesState.busy = false;
    button.disabled = false;
  }
});

/* --------------------------------------------------------------- bootup --- */

const boot = async () => {
  try {
    const health = await api("/api/health");
    state.health = health;
    $("#pin-screen").hidden = true;
    setStateChip("ready", "ok");
    if (health.urls?.length) {
      const entry = health.urls.find((item) => /wi-?fi|wlan|ethernet/i.test(item.name)) ?? health.urls[0];
      $("#lan-url").textContent = `phone: ${entry.url}`;
    }
    if (!health.apiKey) {
      setStateChip("edge mode", "");
    }
    if (health.jobs?.running) {
      state.jobId = health.jobs.running;
      connect(health.jobs.running);
      $("#progress-card").hidden = false;
    }
  } catch (error) {
    setStateChip("server offline", "err");
    console.warn(error);
    toast("Studio server unreachable - retrying every 3s", true);
    setTimeout(boot, 3000);
    return;
  }

  try {
    const draft = localStorage.getItem("studio.draft");
    if (draft) scriptInput.value = draft;
    const savedTitle = localStorage.getItem("studio.title");
    if (savedTitle) titleInput.value = savedTitle;
    const rawScenes = localStorage.getItem("studio.scenes");
    if (rawScenes) {
      const scenes = JSON.parse(rawScenes);
      if (Array.isArray(scenes) && scenes.length > 0) {
        state.scenes = scenes;
        renderScenes();
        $("#scenes-card").hidden = false;
        $("#render-card").hidden = false;
      }
    }
  } catch {
    /* ignore corrupt draft */
  }

  updateEstimate();
  await loadVoices();
  await loadHistory();
};

boot();
