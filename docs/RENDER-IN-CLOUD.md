# Render from your phone (PC off, ₹0)

The video renders on a free GitHub Actions runner. You trigger it from the
GitHub app or from `cloud/index.html`, and the finished MP4 is published as a
GitHub Release asset you can download (and share) from the phone.

```
phone (GitHub app / cloud page)  ->  Actions: Render video  ->  runner: voice + render
                                ->  Release asset  ->  download on phone
```

One render of a ~15-second video takes about 1-2 minutes on the free runner.
Free minutes: unlimited for a public repo (a render uses ~3-6).

> **The repo is public.** GitHub Release assets cannot be downloaded
> cross-origin in a browser (no CORS on the asset CDN), so the phone page uses
> the plain download URL - and that only works without a login on a public
> repo. That means your scripts appear in the public Actions run inputs and the
> finished videos are public. Nothing secret is in the repo itself: `.env` is
> gitignored and the API key lives only in the encrypted Actions secret.

---

## 1. One-time: put the project on GitHub

You need a GitHub account: <https://github.com/signup> (free, no card).

The project lives at <https://github.com/Aanirudra78/stickman> (public).
To use your own copy, fork it, then:

```powershell
cd "C:\Users\sanir\Music\web\stickman render\app"
git remote add origin https://github.com/<YOUR-USER>/<REPO>.git
git push -u origin main
```

Git will ask you to sign in through the browser (or with a personal access
token) the first time.

> `node_modules/`, `out/*.mp4` and `out/qa/` are ignored, so the push is small.
> Renders stay on your PC / in the release assets.

## 2. One-time: add the ElevenLabs secret

Repo -> **Settings** -> **Secrets and variables** -> **Actions** ->
**New repository secret**:

| Name | Value |
|---|---|
| `ELEVENLABS_API_KEY` | your `sk_...` key |

Without the secret the workflow still runs, but the voice falls back to
Microsoft Edge (free, different voice).

## 3. Every video

### Option A - the phone page (one button)

Live at <https://aanirudra78.github.io/stickman-studio/> - open it on the phone
and use Chrome's **Add to Home screen** so it behaves like an app.

On first run, paste the repo (`owner/name`) and a **fine-grained token** with:

- **Actions: Read and write** (dispatch + poll the run)
- **Contents: Read** (find the finished video)

Create it at <https://github.com/settings/personal-access-tokens/new>; the
token stays in `localStorage` on that device and expires after a year.

The page triggers the workflow, polls it live, then plays the MP4 inline and
offers a one-tap download. Because release assets are served without CORS, the
page links to the asset's direct `browser_download_url` instead of downloading
it with `fetch` - `<video>` and a normal link both work fine cross-origin.

`npm run publish:cloud` republishes the page (`cloud/`) to the public
`stickman-studio` repo that GitHub Pages serves.

### Option B - GitHub app

1. **Actions** -> **Render video** -> **Run workflow**.
2. Paste the script as plain text into `script_text` (optional; blank renders
   the committed `public/script.json`), pick `quality` and `voice`.
3. Run. When it finishes, open the **Releases** page and download the MP4.

### Script format for `script_text`

Plain text, not JSON. Blank line = new block, `-` / `1.` lines = a points scene:

```text
The 2-Minute Rule

Starting a new habit? Two minutes is enough.

- Start with 2 minutes
- Keep it easy and small
- Repeat it every day

Tiny start, big results.
```

The same text is parsed by `studio/split.mjs`, so the Studio and CI produce
identical scenes. Keep the narration under ~60-75 seconds.

---

## What the workflow does

1. Installs deps and the headless browser (Ubuntu 24.04 runner).
2. `studio/split.mjs` turns `script_text` into scenes, then
   `scripts/apply-script.mjs` validates them (fails early with a readable
   error). Blank input means "use the committed `public/script.json`".
3. `npm run voiceover` - ElevenLabs (or Edge) with word timings + the heavy
   narrator chain; clips are cached, so unchanged lines are free.
4. `npm run render:video` -> `out/video.mp4` (`--scale=0.5` for `quality: draft`).
5. `scripts/compress-if-needed.mjs` re-encodes only if the file is over 45 MB.
6. `gh release create render-<run_number>` publishes the MP4 as a release
   asset; the phone page plays/downloads it through the direct asset URL.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Run not found on the cloud page | Check the token has Actions: Read and write on that repo. |
| Preview/download asks to sign in | The repo is private. Release assets need a public repo for cross-origin playback. |
| `script error: ...` | A scene is missing `text` / `voiceover` / `pose`; the message names it. |
| ElevenLabs 401 | The repo secret is missing or the key was rotated. |
| ElevenLabs 402 | A Voice Library voice (Ron Sage, Hagen, Atlas, Don) needs the paid plan; pick a premade voice. |
| Voice generation failed | Provider hiccup - press **Re-run failed jobs**. |
| Render timeout | Videos are limited to <1 minute; check the script length. |
| Video over 50 MB | It is auto-compressed to 45 MB. |

## Local fallback (PC on)

```powershell
cd "C:\Users\sanir\Music\web\stickman render\app"
npm install
npm run creator        # local Studio app at http://localhost:4321
```

or the plain CLI:

```powershell
node studio/split.mjs --text-file=notes.txt --out=public/script.json
npm run voiceover
npm run render:video
```
