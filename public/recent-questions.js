(() => {
  const MAX_RECENT_ITEMS = 6;
  let historyList = null;

  function init(options = {}) {
    historyList = options.historyList || document.getElementById('historyList');
  }

  function add(question, answer) {
    if (!historyList || !question || !answer) return;

    const empty = historyList.querySelector('.history-empty');
    if (empty) empty.remove();

    const card = document.createElement('article');
    card.className = 'history-card';

    const icon = document.createElement('span');
    icon.className = 'history-icon';
    icon.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');

    const questionText = document.createElement('p');
    questionText.className = 'history-question';
    questionText.textContent = `Student: ${question}`;

    const answerText = document.createElement('p');
    answerText.className = 'history-answer';
    const shortAnswer = String(answer || '').replace(/\s+/g, ' ').trim();
    answerText.textContent = `Charlemagne: ${
      shortAnswer.length > 180 ? shortAnswer.slice(0, 177) + '...' : shortAnswer
    }`;

    copy.appendChild(questionText);
    copy.appendChild(answerText);
    card.appendChild(icon);
    card.appendChild(copy);
    historyList.prepend(card);

    trim();
  }

  function clear() {
    if (!historyList) return;
    historyList.innerHTML = '<p class="history-empty">No recent questions yet.</p>';
  }

  function trim() {
    if (!historyList) return;
    historyList.querySelectorAll('.history-card').forEach((item, index) => {
      if (index >= MAX_RECENT_ITEMS) item.remove();
    });
  }

  const recentQuestions = {
    add,
    clear,
    init,
    trim
  };

  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.ui = window.Charlemagne.ui || {};
  window.Charlemagne.ui.recentQuestions = recentQuestions;
})();
