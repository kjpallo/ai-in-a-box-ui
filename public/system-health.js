
(function () {
  let initialized = false;
  let lastBackendChecks = [];

  const browserState = {
    audioUnlocked: false,
    audioContextState: "unknown",
    micFound: "unknown",
    micPermission: "unknown"
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function groupFor(check) {
    const id = check.id || "";

    if (id.includes("node") || id.includes("project") || id.includes("server") || id.includes("working_directory")) {
      return "systemServerChecks";
    }

    if (id.includes("ollama")) {
      return "systemOllamaChecks";
    }

    if (id.includes("piper") || id.includes("voice")) {
      return "systemPiperChecks";
    }

    if (id.includes("browser") || id.includes("audio_context") || id.includes("mic")) {
      return "systemBrowserChecks";
    }

    return "systemFileChecks";
  }

  function browserChecks() {
    return [
      {
        id: "browser_audio_unlocked",
        label: "Browser audio unlocked",
        status: browserState.audioUnlocked ? "green" : "yellow",
        message: browserState.audioUnlocked
          ? "Browser audio is unlocked."
          : "Browser audio may need a click before speech plays.",
        details: { audioContextState: browserState.audioContextState }
      },
      {
        id: "audio_context_state",
        label: "AudioContext state",
        status: browserState.audioContextState === "running" ? "green" : "yellow",
        message: "AudioContext state: " + browserState.audioContextState + "."
      },
      {
        id: "mic_found",
        label: "Mic found",
        status: browserState.micFound === true ? "green" : browserState.micFound === false ? "red" : "yellow",
        message:
          browserState.micFound === true
            ? "At least one microphone was found."
            : browserState.micFound === false
              ? "No microphone was found."
              : "Microphone has not been fully checked yet."
      },
      {
        id: "mic_permission",
        label: "Mic permission",
        status:
          browserState.micPermission === "granted"
            ? "green"
            : browserState.micPermission === "denied"
              ? "red"
              : "yellow",
        message: "Mic permission: " + browserState.micPermission + "."
      }
    ];
  }

  function row(check) {
    const status = check.status || "yellow";
    const details =
      check.details && Object.keys(check.details).length
        ? JSON.stringify(check.details, null, 2)
        : "";

    return `
      <div class="system-check-row ${escapeHtml(status)}">
        <span class="system-light ${escapeHtml(status)}"></span>
        <div class="system-check-copy">
          <strong>${escapeHtml(check.label || check.id)}</strong>
          <span>${escapeHtml(check.message || "")}</span>
          ${
            details
              ? `<details><summary>Details</summary><pre>${escapeHtml(details)}</pre></details>`
              : ""
          }
        </div>
      </div>
    `;
  }

  function render(checks) {
    const allChecks = [...checks, ...browserChecks()];

    const groups = {
      systemServerChecks: [],
      systemOllamaChecks: [],
      systemPiperChecks: [],
      systemFileChecks: [],
      systemBrowserChecks: []
    };

    allChecks.forEach((check) => {
      groups[groupFor(check)].push(check);
    });

    Object.entries(groups).forEach(([id, groupChecks]) => {
      const el = byId(id);
      if (!el) return;
      el.innerHTML = groupChecks.length
        ? groupChecks.map(row).join("")
        : '<p class="system-empty">No checks reported.</p>';
    });

    const counts = allChecks.reduce(
      (acc, check) => {
        const key = check.status || "yellow";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { green: 0, yellow: 0, red: 0 }
    );

    if (byId("systemGreenCount")) byId("systemGreenCount").textContent = counts.green || 0;
    if (byId("systemYellowCount")) byId("systemYellowCount").textContent = counts.yellow || 0;
    if (byId("systemRedCount")) byId("systemRedCount").textContent = counts.red || 0;
  }

  async function refreshHealth() {
    const status = byId("systemHealthStatus");
    const checked = byId("systemHealthChecked");

    if (status) status.textContent = "Checking local services...";

    try {
      const response = await fetch("/api/system-health", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const data = await response.json();
      lastBackendChecks = data.checks || [];
      render(lastBackendChecks);

      if (status) {
        status.textContent = data.healthy
          ? "Health check complete. Backend looks good."
          : "Health check complete. Review red and yellow lights.";
      }

      if (checked) {
        checked.textContent = "Last checked: " + new Date().toLocaleTimeString();
      }
    } catch (error) {
      lastBackendChecks = [
        {
          id: "system_health_endpoint",
          label: "System health endpoint",
          status: "red",
          message: "Could not load /api/system-health.",
          details: { error: error.message }
        }
      ];

      render(lastBackendChecks);

      if (status) status.textContent = "Could not load /api/system-health.";
      if (checked) checked.textContent = "Last checked: failed at " + new Date().toLocaleTimeString();
    }
  }

  async function checkAudio() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        browserState.audioUnlocked = false;
        browserState.audioContextState = "unsupported";
        return;
      }

      const ctx = new AudioContextClass();

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      browserState.audioUnlocked = ctx.state === "running";
      browserState.audioContextState = ctx.state;
    } catch {
      browserState.audioUnlocked = false;
      browserState.audioContextState = "error";
    }
  }

  async function quickMicCheck() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      browserState.micFound = false;
      browserState.micPermission = "unsupported";
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      browserState.micFound = devices.some((device) => device.kind === "audioinput");
    } catch {
      browserState.micFound = "unknown";
    }
  }

  async function checkMicPermission() {
    const status = byId("systemHealthStatus");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      browserState.micFound = false;
      browserState.micPermission = "unsupported";
      render(lastBackendChecks);
      return;
    }

    try {
      if (status) status.textContent = "Checking microphone permission...";

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      browserState.micPermission = "granted";
      await quickMicCheck();

      if (status) status.textContent = "Microphone permission granted.";
    } catch (error) {
      browserState.micPermission = error && error.name === "NotAllowedError" ? "denied" : "error";
      browserState.micFound = "unknown";

      if (status) status.textContent = "Microphone permission was denied or failed.";
    }

    render(lastBackendChecks);
  }

  async function init() {
    if (initialized) return;

    const refreshButton = byId("systemRefreshHealth");
    const micButton = byId("systemCheckMic");

    if (!refreshButton || !micButton) return;

    initialized = true;

    refreshButton.addEventListener("click", async () => {
      await checkAudio();
      await quickMicCheck();
      await refreshHealth();
    });

    micButton.addEventListener("click", async () => {
      await checkAudio();
      await checkMicPermission();
      await refreshHealth();
    });

    await quickMicCheck();
    await refreshHealth();
  }

  document.addEventListener("DOMContentLoaded", init);
  setTimeout(init, 250);
  setTimeout(init, 1000);

  const observer = new MutationObserver(init);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
