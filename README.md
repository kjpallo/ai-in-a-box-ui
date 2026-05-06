# AI in a Box

Local classroom assistant UI for a Raspberry Pi.

## What this version does

- Streams text back from Ollama as it is generated.
- Splits the answer into sentences when it sees `.`, `!`, or `?`.
- Sends each finished sentence to Piper right away.
- Streams Piper audio chunks to the browser in order so speech can begin before the whole response is finished.
- Keeps the browser audio path, which fits HDMI audio on the Pi.
- Uses local router/formula rules and local knowledge files for trusted classroom answers.
- Includes a 400-question router test bank for accuracy checks before adding more UI or formula families.

## Files to care about

- `public/index.html` = what is on the page
- `public/style.css` = what it looks like
- `public/app.js` = main teacher app startup wiring
- `public/api-client.js` = browser API calls
- `public/question-input.js` = teacher question form and streamed answer events
- `public/answer-renderer.js` = answer panel rendering
- `public/recent-questions.js` = recent question list
- `public/blade-ui.js` = side/bottom blade shell UI
- `public/voice/` = voice input, commands, status, and TTS playback modules
- `public/student/student-ui.js` = student page/session flow
- `public/audio-stream-processor.js` = low-latency browser audio playback for Piper PCM chunks
- `server.js` = local HTTP server and streaming chat endpoint
- `lib/router/questionRouter.js` = local router that decides which trusted tool should answer
- `lib/formulas/` = local science formula rules, being split one formula family at a time
- `lib/knowledge/` = local chemistry, periodic table, and teacher knowledge helpers
- `lib/ollama/client.js` = local Ollama client
- `lib/tts/piper.js` = local Piper TTS service

## Router tests

Run the small regression suite:

```bash
npm test
```

Run the full 400-question teacher test bank:

```bash
npm run test:bank
```

Run both:

```bash
npm run test:all
```

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
npm run test:all
npm run check:cleanup
```

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
