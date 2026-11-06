# Render from your phone (PC off, ₹0)

The video renders on a free GitHub Actions runner. You trigger it from the
GitHub app, and the finished MP4 arrives in Telegram. No server, no card.

```
phone (GitHub app)  ->  Actions: Render video  ->  runner: voice + render  ->  Telegram
```

One render of a 22-second video takes roughly 3-5 minutes on the free runner.
Free minutes: 2000/month for a private repo (a render uses ~5).

---

## 1. One-time: put the project on GitHub

You need a GitHub account: <https://github.com/signup> (free, no card).

Git is now installed on this PC (2.56) and `app/` is already a git repository
with one commit on `main`, so there is nothing to prepare locally - only the
remote is missing.

### Create the repo and push

On GitHub: **New repository** -> name `stickman-render` -> **Private** -> Create.
Do **not** add a README or .gitignore (the project already has one).

```powershell
cd "C:\Users\sanir\Music\web\stickman render\app"
git remote add origin https://github.com/<YOUR-USER>/stickman-render.git
git push -u origin main
```

Git will ask you to sign in through the browser (or with a personal access
token) the first time.

> If you ever need to redo the local repo:
> `git init -b main; git add .; git commit -m "initial"`.

> `node_modules/`, `out/*.mp4` and `out/qa/` are ignored, so the push is only
> ~2 MB. Renders stay on your PC / in the baseline zip.

---

## 2. One-time: Telegram bot

1. Install Telegram on the phone.
2. Open **@BotFather** -> `/newbot` -> pick a name -> copy the **token**
   (looks like `123456789:AA...`).
3. Open your new bot and send it `/start` (any message works).
4. Get your chat id: open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` in the phone browser.
   Look for `"chat":{"id":123456789,...}` - that number is the chat id.

## 3. One-time: add the secrets

Repo -> **Settings** -> **Secrets and variables** -> **Actions** ->
**New repository secret**:

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | the BotFather token |
| `TELEGRAM_CHAT_ID` | your numeric chat id |

---

## 4. Every video

### Option A - edit the script file (easiest on a phone)

1. GitHub app -> repo -> `public/script.json` -> pencil icon.
2. Edit the scenes (see format below), commit to `main`.
3. **Actions** -> **Render video** -> **Run workflow** -> Run.

### Option B - paste JSON when starting the run

`script_json` accepts the whole script as **one line** of JSON:

```json
{"title":"The 2-Minute Rule","voice":"en-US-AndrewMultilingualNeural","scenes":[{"text":"The 2-Minute Rule\nfrom Atomic Habits","voiceover":"The two minute rule, from Atomic Habits.","pose":"idle","scene_type":"text","duration":2,"speaking":false,"pose_changes":[{"at":1.22,"pose":"pointing"}]}]}
```

Leave the field empty to render whatever is in `public/script.json`.

### Script format

```jsonc
{
  "title": "The 2-Minute Rule",
  "voice": "en-US-AndrewMultilingualNeural",   // keep this for the same voice
  "scenes": [
    {
      "text": "Line one\nLine two",            // headings / statement
      "voiceover": "What the narrator says.",  // required
      "pose": "idle",                          // idle|talking|pointing|thinking|surprised|happy
      "scene_type": "text",                    // text | points
      "duration": 2,                           // seconds (minimum; grown to fit narration)
      "speaking": false,
      "pose_changes": [{ "at": 1.2, "pose": "pointing" }],  // optional
      "items": ["Only for points scenes", "One per bullet"]
    }
  ]
}
```

Keep the whole thing under ~60 seconds of narration so the file stays well
inside Telegram's 50 MB bot upload limit.

---

## What the workflow does

1. Installs deps and the headless browser (Ubuntu 24.04 runner).
2. `scripts/apply-script.mjs` validates the pasted JSON (fails early with a
   readable error if something is missing). An empty input means "use the
   committed `public/script.json`".
3. `npm run voiceover` - Microsoft Edge TTS, **same voice**
   (`en-US-AndrewMultilingualNeural`, rate `-4%`), word timings updated.
4. `npm run render:video` -> `out/video.mp4`.
5. `scripts/compress-if-needed.mjs` re-encodes only if the file is over 45 MB.
6. `scripts/telegram-notify.mjs` uploads the MP4 to your chat.
7. The full-quality file is also kept as a 14-day workflow artifact.

## Troubleshooting

| Symptom | Fix |
|---|---|
| No Telegram message | Check the two secrets; send `/start` to the bot once. |
| `script error: ...` | The JSON is missing a field - the message names the scene. |
| Voice generation failed | Microsoft TTS hiccup - press **Re-run failed jobs**. |
| Render timeout | Videos are limited to <1 minute; check `duration` values. |
| Video over 50 MB | It is auto-compressed to 45 MB; for the master, use the artifact. |

## Local fallback (PC on)

```powershell
cd "C:\Users\sanir\Music\web\stickman render\app"
npm install
npm run voiceover
npm run render:video
```
