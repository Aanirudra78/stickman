/**
 * Sends the finished video (or a status message) to Telegram.
 *
 *   node scripts/telegram-notify.mjs --video out/video.mp4 --caption "..."
 *   node scripts/telegram-notify.mjs --text "render failed: ..."
 *
 * Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID. When they are missing the
 * script exits 0 with a warning, so the render itself is never failed by a
 * missing notification channel.
 */
import fs from "node:fs/promises";
import path from "node:path";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const CHAT_ID = process.env.TELEGRAM_CHAT_ID?.trim();
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;
/** Bot upload limit is 50 MB; leave a little headroom. */
const MAX_UPLOAD_BYTES = 48 * 1024 * 1024;

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const caption = (
  argValue("--caption") ??
  process.env.TELEGRAM_CAPTION ??
  "Stickman render"
).slice(0, 1000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const call = async (method, init) => {
  const response = await fetch(`${API}/${method}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    const retryAfter = body?.parameters?.retry_after;
    const error = new Error(
      `${method} -> ${response.status} ${body.description ?? ""}`.trim(),
    );
    error.retryAfter = retryAfter;
    throw error;
  }
  return body.result;
};

const withRetry = async (method, init) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await call(method, init);
    } catch (error) {
      if (attempt === 3) throw error;
      const wait = Math.min(30, error.retryAfter ?? attempt * 3);
      console.log(`${error.message} - retrying in ${wait}s`);
      await sleep(wait * 1000);
    }
  }
};

const main = async () => {
  if (!TOKEN || !CHAT_ID) {
    console.log(
      "telegram: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set - skipping notification",
    );
    return;
  }

  const videoArg = argValue("--video") ?? process.env.TELEGRAM_VIDEO;
  const textArg = argValue("--text");

  if (!videoArg) {
    const text = textArg ?? caption;
    await withRetry("sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    });
    console.log("telegram: message sent");
    return;
  }

  const file = path.resolve(process.cwd(), videoArg);
  const { size } = await fs.stat(file);

  if (size > MAX_UPLOAD_BYTES) {
    await withRetry("sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text:
          `${caption}\n\n` +
          `Video is ${(size / (1024 * 1024)).toFixed(1)} MB - over Telegram's ` +
          `50 MB bot limit, so it was not uploaded.`,
      }),
    });
    console.log("telegram: too large, sent a note instead");
    return;
  }

  const data = await fs.readFile(file);
  const form = new FormData();
  form.append("chat_id", CHAT_ID);
  form.append("caption", caption);
  form.append("supports_streaming", "true");
  form.append(
    "video",
    new Blob([data], { type: "video/mp4" }),
    path.basename(file),
  );

  const message = await withRetry("sendVideo", { method: "POST", body: form });
  console.log(
    `telegram: video sent (${(size / (1024 * 1024)).toFixed(1)} MB, message ${message.message_id})`,
  );
};

main().catch((error) => {
  console.error(`telegram failed: ${error?.message ?? error}`);
  process.exit(1);
});
