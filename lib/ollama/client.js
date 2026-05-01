const { formatKnowledgeForPrompt } = require('../knowledge/teacherKnowledge');

function createOllamaClient(config) {
  return {
    stream: (options) => streamFromOllama(config, options),
    buildTeacherPrompt: (options) => buildTeacherPrompt(options),
    extractCompletedSentences
  };
}

async function streamFromOllama(config, { prompt, onText, signal }) {
  console.log('Calling Ollama:', config.url, 'model:', config.model);
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      system: config.systemPrompt,
      prompt,
      stream: true,
      options: {
        temperature: config.temperature,
        num_predict: config.numPredict,
        top_k: config.topK,
        top_p: config.topP,
        repeat_penalty: config.repeatPenalty
      }
    }),
    signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ollama request failed with status ${response.status}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }

      if (parsed.response) {
        onText(parsed.response);
      }

      if (parsed.done) {
        return;
      }
    }
  }
}

function buildTeacherPrompt({ message, matchedKnowledge = [], questionRoute = null }) {
  const parts = [];

  if (questionRoute) {
    parts.push(
      'LOCAL QUESTION ROUTER (hidden from students):',
      JSON.stringify(questionRoute.public),
      'Router rule: strong = use trusted local info first; weak = say something is related and be careful; none = do not make up a science answer.',
      ''
    );
  }

  if (questionRoute && questionRoute.calculatorResult) {
    parts.push(
      'LOCAL CALCULATOR RESULT (hidden from students):',
      'Expression: ' + questionRoute.calculatorResult.expression,
      'Answer: ' + questionRoute.calculatorResult.displayValue,
      'Use this local calculator result as correct. Do not recalculate it differently.',
      'Explain it simply for a 9th-grade student if an explanation is needed.',
      ''
    );
  }

  if (matchedKnowledge.length) {
    parts.push(
      'LOCAL VERIFIED CLASS REFERENCE (hidden from students):',
      'Use ONLY this local verified class reference when answering the student.',
      'If this reference conflicts with your general memory, use this reference.',
      'If multiple local references match, combine the useful parts into one clear answer.',
      'If the student asks about force of gravity, distinguish between weight force Fg = m × g and Earth gravity g = 9.8 m/s^2 when those references are provided.',
      'Do not add facts that are not in the local reference.',
      'Do not tell students you looked up a hidden database unless the teacher asks.',
      formatKnowledgeForPrompt(matchedKnowledge),
      ''
    );
  }

  parts.push(
    'Teacher request:',
    message,
    '',
    'Follow the classroom instructions above. Answer for a 9th-grade science student.',
    'If a calculation is needed and a trusted formula or constant is provided above, use it and show the formula, substitution, and units.'
  );

  return parts.join('\n');
}

function extractCompletedSentences(text) {
  const complete = [];
  let lastCut = 0;
  const matches = text.matchAll(/[^.!?\n]+[.!?]+(?:\s+|$)|[^\n]+\n+/g);

  for (const match of matches) {
    const sentence = match[0].trim();
    if (sentence) complete.push(sentence);
    lastCut = match.index + match[0].length;
  }

  return {
    complete,
    remaining: text.slice(lastCut)
  };
}

module.exports = { createOllamaClient };
