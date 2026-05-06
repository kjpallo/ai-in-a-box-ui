(() => {
  let elements = {};

  function init(options = {}) {
    elements = {
      responseText: options.responseText || document.getElementById('responseText'),
      copyButton: options.copyButton || document.getElementById('copyAnswerButton'),
      clearButton: options.clearButton || document.getElementById('clearButton'),
      messageInput: options.messageInput || document.getElementById('messageInput')
    };

    setupCopyButton();
    setupClearButton(options.onClear);
    renderEmpty();
  }

  function renderEmpty() {
    const responseText = elements.responseText;
    if (!responseText) return;

    responseText.classList.remove('streaming', 'has-answer');
    responseText.classList.add('response-empty');
    responseText.innerHTML = `
      <div class="answer-empty-state">
        <div class="answer-empty-spark" aria-hidden="true"></div>
        <h3>Answer will appear here</h3>
        <p>Charlemagne is ready to help you teach with clarity and confidence.</p>
        <div class="answer-feature-row" aria-label="Answer benefits">
          <div class="answer-feature">
            <span aria-hidden="true">✣</span>
            <div>
              <strong>Curriculum Aligned</strong>
              <small>Standards-based explanations</small>
            </div>
          </div>
          <div class="answer-feature">
            <span aria-hidden="true">◎</span>
            <div>
              <strong>Student Focused</strong>
              <small>Clear, accurate, and age-appropriate</small>
            </div>
          </div>
          <div class="answer-feature">
            <span aria-hidden="true">♢</span>
            <div>
              <strong>Teacher Ready</strong>
              <small>Save time and teach with confidence</small>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function startStreaming() {
    const responseText = elements.responseText;
    if (!responseText) return;

    responseText.textContent = '';
    responseText.classList.remove('has-answer', 'response-empty');
    responseText.classList.add('streaming');
  }

  function appendText(chunk) {
    const responseText = elements.responseText;
    if (!responseText) return;

    responseText.classList.add('has-answer');
    responseText.textContent += String(chunk || '');
  }

  function renderError(message) {
    const responseText = elements.responseText;
    if (!responseText) return;

    responseText.textContent = message || 'The classroom assistant is not connected right now. Tell your teacher.';
    responseText.classList.remove('response-empty');
    responseText.classList.add('has-answer');
  }

  function finish() {
    elements.responseText?.classList.remove('streaming');
  }

  function getAnswerText() {
    return String(elements.responseText?.textContent || '').trim();
  }

  function setupCopyButton() {
    const { copyButton } = elements;
    if (!copyButton || copyButton.dataset.charlemagneBound === 'true') return;

    copyButton.dataset.charlemagneBound = 'true';
    copyButton.addEventListener('click', async () => {
      const text = getAnswerText();
      if (!text || elements.responseText?.classList.contains('response-empty') || text === 'Answer will appear here') return;

      try {
        await navigator.clipboard.writeText(text);
        copyButton.textContent = 'Copied';
      } catch {
        copyButton.textContent = 'Copy failed';
      }

      window.setTimeout(() => {
        copyButton.textContent = 'Copy Answer';
      }, 1200);
    });
  }

  function setupClearButton(onClear) {
    const { clearButton } = elements;
    if (!clearButton || clearButton.dataset.charlemagneBound === 'true') return;

    clearButton.dataset.charlemagneBound = 'true';
    clearButton.addEventListener('click', () => {
      renderEmpty();
      if (elements.messageInput) {
        elements.messageInput.value = '';
        elements.messageInput.focus();
      }
      if (typeof onClear === 'function') onClear();
    });
  }

  const renderer = {
    appendText,
    finish,
    getAnswerText,
    init,
    renderEmpty,
    renderError,
    startStreaming
  };

  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.ui = window.Charlemagne.ui || {};
  window.Charlemagne.ui.answer = renderer;
})();
