# AI in a Box

Local classroom assistant UI for a Raspberry Pi.

## Start the app

Install dependencies once, then start the local server:

```bash
npm install
npm start
```

The teacher console runs at `http://localhost:3000/`. The student classroom page runs at `http://localhost:3000/student.html`.

## What this version does

- Streams text back from Ollama as it is generated.
- Splits the answer into sentences when it sees `.`, `!`, or `?`.
- Sends each finished sentence to Piper right away.
- Streams Piper audio chunks to the browser in order so speech can begin before the whole response is finished.
- Keeps the browser audio path, which fits HDMI audio on the Pi.
- Uses local router/formula rules and local knowledge files for trusted classroom answers.
- Includes a 400-question router test bank for accuracy checks before adding more UI or formula families.

## Major code areas

- `server.js` wires the Express app, static files, auth/session middleware, and API route modules.
- `routes/` contains backend route modules for auth, chat/router, student sessions, classroom controls, teacher content, voice/Whisper, profile, health, and AI-improvement endpoints.
- `public/` contains the teacher console, student page, shared browser modules, voice modules, and split teacher-content frontend modules.
- `public/teacher-content/` contains the teacher content dashboard modules for uploads, review, approved packs, standards panels, and status/render helpers.
- `lib/router/` contains the active classroom question router. The root `lib/questionRouter.js` file is only a compatibility wrapper.
- `lib/formulas/` contains formula parsing, answer formatting, and formula-family tools. The root `lib/scienceFormulaTools.js` file is only a compatibility wrapper.
- `lib/knowledge/` contains teacher knowledge pack loading, review, promotion, approval, chemistry, periodic table, and pack quality helpers. Root `lib/chemistryTools.js` and `lib/periodicTableTools.js` are compatibility wrappers.
- `lib/uploads/` contains teacher upload detection, extraction, draft-pack generation, source evidence, import reports, and storage helpers.
- `lib/standards/` and `knowledge/standards*/` contain standards matching, bank validation, profile config, and standards data.
- `scripts/` contains regression tests, cleanup/review utilities, upload/knowledge pack tools, and audit helpers.
- `tests/routerTestBank.js` contains the large classroom router regression bank.
- `docs/refactor-map.md` documents compatibility wrappers, protected areas, local artifact folders, and oversized files for future cleanup.

## Core test commands

Run the core classroom prototype regression suite:

```bash
npm run test:classroom-core
```

Run teacher content/upload regression checks:

```bash
npm run test:teacher-content
```

Run the smaller default classroom smoke suite:

```bash
npm test
```

Run focused Charlemagne motion/force student regression checks:

```bash
npm run test:motion-force-student-regressions
```

Run the 400-question teacher router bank:

```bash
npm run test:bank
```

Run cleanup/review safety checks:

```bash
npm run check:cleanup
```

## Teacher Auth

Phase 1 teacher auth uses a local `logs/teacher_auth.json` file for one teacher account. This file is local-only, ignored by git through the `logs/` ignore rule, and should not be committed.

The teacher PIN/password is never stored directly. The app stores a salted `scrypt` hash, plus the teacher username, optional linked Google identity fields (`linkedGoogleEmail`, `linkedGoogleName`, and `googleLinkedAt`), recovery-code hash metadata, and created/updated timestamps. The auth file is written with `chmod 600` when the local filesystem supports it.

During first-time setup, Charlemagne shows a one-time recovery code. Save this recovery code somewhere safe; it is the local proof needed to reset the teacher PIN/password if Google recovery is not connected yet. The raw recovery code is never stored in `logs/teacher_auth.json`, only a secure hash is stored. When the recovery code is used to reset the PIN/password, Charlemagne rotates it and shows the new recovery code one time.

For owner/admin recovery from the terminal, run:

```bash
npm run reset:teacher-auth -- --confirm
```

This moves `logs/teacher_auth.json` to a timestamped backup file so first-time setup can run again. It does not touch `logs/teacher_gmail_auth.json`.

Student routes stay separate from teacher login. The student page and `/api/student/message` do not require teacher authentication, while teacher-only routes such as profile, chat, system health, router test, AI improvement, and Whisper endpoints require the local teacher session cookie.

Google is optional. The local username plus PIN/password is used for daily teacher login, and teachers do not need Google to unlock the app.

Gmail OAuth is separate from local teacher login. Gmail OAuth tokens stay in `logs/teacher_gmail_auth.json`; teacher identity fields stay in `logs/teacher_auth.json`. Gmail tokens are not stored in the local teacher auth file.

## Teacher Knowledge Packs

`knowledge/schema/` and `knowledge/packs/` contain the first scaffold for teacher-customizable subject knowledge packs. This is data-only groundwork: the current router, formula behavior, and student answer flow are unchanged.

Teachers will eventually create and edit approved JSON through forms. A future upload flow can be: upload -> local model draft -> teacher review -> approved JSON. For now, teachers provide content and approval data while hard tools like formula solving, chemistry lookup, history lookup, vocabulary lookup, and standards tracking remain prebuilt app tools.

Phase 3 adds a local standards/concept matcher that reads the sample pack and tags likely concepts, units, and standards.

Phase 4 attaches compact standards/concept metadata to completed student interaction logs. Student answers are unchanged. A future phase will summarize logs by standard, concept, unit, and route type.

Phase 5 adds a backend standards summary report endpoint at `/api/profile/standards-summary`. It summarizes completed student interaction logs by standard, concept, unit, route type, and standards confidence without changing student answers, router behavior, formulas, or expected answer text. This phase does not build the teacher dashboard yet; Phase 6 will show this report in the teacher dashboard/report UI.

Phase 6 displays the standards summary report in the teacher/profile Class Activity UI using `/api/profile/standards-summary`. It is a read-only reporting view for totals, confidence counts, standards, concepts, units, route types, and recent tagged questions. It does not add uploads or teacher editing yet. Future Phase 7 will add a manual teacher form to create/edit JSON knowledge items.

Phase 7A adds the `missouri_science_6_12` master standards bank and course profile config. The default `physical_science` profile treats 9-12 PS1, PS2, PS3, and PS4 as core and 9-12 ETS1 as supporting; LS, ESS, and 6-8 standards are in the bank but off/selectable by default for this profile. Student answers, router behavior, formulas, and expected answer text are unchanged. Future Phase 7B will add blade UI for teachers to turn standards/domains on and off.

Phase 7D separates concept confidence from standards confidence in completed interaction logs. `primaryStandards` are counted as official standards matches, while `possibleStandards` are saved for teacher review without counting as primary standards. Student answers are unchanged. A future standards blade UI can use this cleaner log shape.

## Before pushing to GitHub

```bash
npm run test:classroom-core
npm run test:teacher-content
npm run check:cleanup
```

## Safe review handoff zip

Use the safe export command below to create a timestamped review zip in `~/Downloads`:

```bash
npm run review:zip
```

This command includes app/source review files, tests, public UI files, package files, docs, and review-safe knowledge definitions. It excludes local secrets/artifacts such as `.env*`, `logs/`, `node_modules/`, uploads/extracted upload caches, archived review history, model response temp files, build outputs, and other token/secret/auth-named files. It also runs a suspicious-path check and fails if any risky path is still present.

Review zips are intentionally built from an explicit include list in `scripts/create-review-zip.sh`. They do not include local logs, auth files, upload originals/extractions, backup folders, scratch output, deleted/accepted/removed draft archives, model files, voice files, or previous review handoff output.

## Package scripts

`package.json` keeps scripts grouped by purpose: app startup, core classroom tests, auth, router/standards tests, knowledge-pack tests, teacher-content tests, upload/import tests, voice organization, inspection/audit utilities, cleanup checks, and review zip export.

The most common commands are:

```bash
npm start
npm run test:classroom-core
npm run test:teacher-content
npm run review:zip
npm run check:cleanup
```

## Cleanup audit notes

The cleanup checker is read-only. It reports local artifact folders and oversized files so cleanup can happen deliberately without changing classroom behavior during audit passes.

Oversized data/test files are currently documented rather than split when splitting would risk router, knowledge, or teacher-content behavior. The compatibility wrappers listed in `docs/refactor-map.md` stay in place for old require paths and legacy browser paths until a future compatibility-removal pass confirms no external consumers need them.

## Before running on the Pi

Start the app, then check local system health:

```bash
http://localhost:3000/api/system-health
```

## Streaming mode design

This build is set up for the simplest real streaming path on the Pi:

1. Ollama streams text.
2. `server.js` watches for completed sentences.
3. Each sentence is queued.
4. Piper is started for that sentence with `--output-raw`.
5. Raw PCM chunks are pushed to the browser as NDJSON events.
6. An AudioWorklet in the browser plays the chunks through HDMI audio.

## Important voice requirement

For streaming mode, put **both** of these files in the `voices/` folder:

- `your-voice.onnx`
- `your-voice.onnx.json`

The `.json` file tells the app the Piper sample rate. Without it, the browser does not know how to play the raw PCM stream correctly.

If you do not have the `.onnx.json` file, you can set a fallback manually:

```bash
export PIPER_SAMPLE_RATE=22050
```

Only use that if you are sure the voice actually uses that sample rate.

## Local CLI streaming setup on the Pi

This is the path this build is aiming at.

```bash
export PIPER_BACKEND=cli
export PIPER_AUDIO_MODE=stream
npm start
```

## Local Whisper Push to Talk setup

Push to Talk uses local `whisper.cpp`; it does not use any cloud API.

On the Raspberry Pi, install or build `whisper.cpp` separately, then put the model file at:

```bash
models/ggml-tiny.en.bin
```

Set these paths in `.env` or in the shell that starts the app:

```bash
WHISPER_CPP_BIN=vendor/whisper.cpp/build/bin/whisper-cli
WHISPER_MODEL=models/ggml-tiny.en.bin
FFMPEG_BIN=/usr/bin/ffmpeg
WHISPER_LANGUAGE=en
WHISPER_TIMEOUT_MS=60000
```

Older `whisper.cpp` builds may produce `main` instead of `whisper-cli`; if so, set `WHISPER_CPP_BIN` to that executable.

Check readiness from the teacher computer:

```bash
curl http://localhost:3000/api/whisper/health
```

The app is ready for Push to Talk when that response has `"ready":true`. If it is false, the `missing` array shows which local file or command still needs attention.

## File mode fallback

If you want to fall back to WAV files instead of chunked streaming:

```bash
export PIPER_BACKEND=cli
export PIPER_AUDIO_MODE=file
npm start
```

## HTTP mode fallback

If you later decide to run Piper as a local HTTP service instead, this app can still use it, but that path returns files instead of low-latency PCM chunks.

```bash
export PIPER_BACKEND=http
export PIPER_HTTP_URL=http://127.0.0.1:5001/tts
npm start
```

## Why streaming mode is CLI-only here

The browser-safe low-latency path in this build uses Piper raw PCM output from `--output-raw` and sends those chunks straight to an AudioWorklet.
That keeps the response feeling more natural because the first sentence can start speaking quickly.
