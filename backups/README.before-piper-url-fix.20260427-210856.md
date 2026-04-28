# AI in a Box

Local classroom assistant UI for a Raspberry Pi.

## What this version does

- Streams text back from Ollama as it is generated.
- Splits the answer into sentences when it sees `.`, `!`, or `?`.
- Sends each finished sentence to Piper right away.
- Streams Piper audio chunks to the browser in order so speech can begin before the whole response is finished.
- Keeps the browser audio path, which fits HDMI audio on the Pi.

## Files to care about

- `public/index.html` = what is on the page
- `public/style.css` = what it looks like
- `public/app.js` = what the page does
- `public/audio-stream-processor.js` = low-latency browser audio playback for Piper PCM chunks
- `server.js` = how it talks to Ollama and Piper

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
export PIPER_HTTP_URL=http://127.0.0.1:5000
npm start
```

## Why streaming mode is CLI-only here

The browser-safe low-latency path in this build uses Piper raw PCM output from `--output-raw` and sends those chunks straight to an AudioWorklet.
That keeps the response feeling more natural because the first sentence can start speaking quickly.
