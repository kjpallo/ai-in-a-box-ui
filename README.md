# AI in a Box UI Starter

This starter gives you:

- `index.html` for the page layout
- `style.css` for the look
- `app.js` for streaming text + audio queue behavior
- `server.js` for the Node backend that talks to Ollama and Piper
- `public/media/fox.mp4` already wired into the visualizer circle

## Run it

```bash
npm install
npm start
```

Then open:

```bash
http://localhost:3000
```

## Project shape

```txt
/project
  server.js
  package.json
  /public
    index.html
    style.css
    app.js
    /media
      fox.mp4
  /voices
    your-piper-voice.onnx
    your-piper-voice.onnx.json
  /audio
```

## Piper voice setup

Drop your Piper voice files into `/voices`.

Example:

```txt
/voices
  en_US-voice.onnx
  en_US-voice.onnx.json
```

The server will use the first `.onnx` file it finds.

## What is already working

- Fox video inside the right-side circle
- Circle pulses when audio is playing
- Text streams into the neon response box
- Audio queue logic is already in place
- If Piper voice is not installed yet, the UI still simulates speaking timing so you can test the visualizer

## What to do next

1. Install Ollama and pull the model you want.
2. Install Piper so `piper` works from the terminal.
3. Drop your voice model into `/voices`.
4. Test a prompt.
5. After that, you can improve the orb so it reacts to real audio volume, not just speaking state.
