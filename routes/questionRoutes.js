function registerQuestionRoutes(app, {
  ollama,
  questionAnswer,
  tts
}) {
  app.get('/api/router-test', (req, res) => {
    const message = String(req.query.q || '').trim();
    const { matchedKnowledge, questionRoute } = questionAnswer.routeMessage(message);

    res.json({
      question: message,
      router: questionRoute.public,
      answerPreview: questionRoute.directAnswer,
      matchedKnowledge: matchedKnowledge.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        score: item.score,
        exactTermMatch: item.exactTermMatch,
        exactTitleMatch: item.exactTitleMatch,
        importantKeywordMatches: item.importantKeywordMatches,
        strongEnoughMatch: item.strongEnoughMatch
      }))
    });
  });

  app.post('/api/chat', async (req, res) => {
    const message = (req.body?.message || '').trim();
    const selectedVoiceId = (req.body?.voice || '').trim();
    console.log('Incoming message:', message);

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const abortController = new AbortController();
    let clientClosed = false;
    let sentenceIndex = 0;
    let ttsChain = Promise.resolve();

    req.on('aborted', () => {
      clientClosed = true;
      abortController.abort();
    });

    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
        abortController.abort();
      }
    });

    const sendEvent = (payload) => {
      if (clientClosed) return;
      res.write(`${JSON.stringify(payload)}\n`);
    };

    sendEvent({
      type: 'start',
      voice: selectedVoiceId || null,
      ttsBackend: tts.getEffectiveTtsBackend(),
      ttsAudioMode: tts.getEffectiveAudioMode(),
      canStreamAudio: tts.canStreamAudio()
    });

    let fullText = '';
    let matchedKnowledge = [];
    let questionRoute = null;
    let usedAiFallback = false;

    try {
      let pending = '';
      let speechBuffer = [];
      let firstChunkSent = false;

      ({ matchedKnowledge, questionRoute } = questionAnswer.routeMessage(message));

      console.log('Knowledge matches:', matchedKnowledge.map((item) => item.title || item.id));
      console.log('Question route:', questionRoute.public);
      sendEvent({ type: 'router', router: questionRoute.public });

      questionAnswer.maybeLogReviewQuestion({
        message,
        questionRoute,
        matchedKnowledge,
        answerGiven: questionRoute.directAnswer
      });

      if (questionRoute.directAnswer && !questionRoute.aiAllowed) {
        fullText += questionRoute.directAnswer;
        sendEvent({ type: 'text_delta', chunk: questionRoute.directAnswer });
        queueSentenceForSpeech(questionRoute.directAnswer);
      } else {
        usedAiFallback = true;
        await ollama.stream({
          prompt: ollama.buildTeacherPrompt({ message, matchedKnowledge, questionRoute }),
          signal: abortController.signal,
          onText(textChunk) {
            if (!textChunk || clientClosed) return;

            fullText += textChunk;
            pending += textChunk;
            sendEvent({ type: 'text_delta', chunk: textChunk });

            const { complete, remaining } = ollama.extractCompletedSentences(pending);
            pending = remaining;

            for (const sentence of complete) {
              const cleaned = sentence.trim();
              if (!cleaned) continue;

              speechBuffer.push(cleaned);

              if (!firstChunkSent) {
                if (speechBuffer.length >= 2) {
                  queueSentenceForSpeech(speechBuffer.join(' '));
                  speechBuffer = [];
                  firstChunkSent = true;
                }
              } else {
                queueSentenceForSpeech(speechBuffer.shift());
              }
            }
          }
        });
      }

      const trailing = pending.trim();
      if (trailing) {
        speechBuffer.push(trailing);
      }

      if (speechBuffer.length > 0) {
        if (!firstChunkSent) {
          queueSentenceForSpeech(speechBuffer.join(' '));
        } else {
          for (const chunk of speechBuffer) {
            queueSentenceForSpeech(chunk);
          }
        }
      }

      if (usedAiFallback) {
        questionAnswer.logAiImprovementProblem({
          message,
          questionRoute,
          matchedKnowledge,
          answerGiven: fullText,
          category: 'fallback_review',
          reason: 'fallback',
          source: 'auto'
        });
      }

      questionAnswer.logCompletedInteraction({
        message,
        questionRoute,
        answerGiven: fullText,
        source: usedAiFallback ? 'chat_ai_fallback' : 'chat_router'
      });

      await ttsChain;

      sendEvent({ type: 'done', fullText });
      res.end();
    } catch (error) {
      console.error('Chat route error:', error);
      if (!clientClosed) {
        const safeMessage = 'I do not have a trusted answer for that yet. Ask your teacher or try rewording the question.';
        questionAnswer.logAiImprovementProblem({
          message,
          questionRoute,
          matchedKnowledge,
          answerGiven: fullText || safeMessage,
          category: 'server_error',
          reason: 'server_error',
          source: 'auto',
          debug: {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack
            }
          }
        });
        sendEvent({ type: 'error', message: safeMessage });
        res.end();
      }
    }

    function queueSentenceForSpeech(sentence) {
      if (!sentence) return;

      const itemNumber = sentenceIndex++;
      ttsChain = ttsChain
        .then(async () => {
          await tts.streamSentenceAudio({
            sentence,
            index: itemNumber,
            selectedVoiceId,
            sendEvent,
            signal: abortController.signal,
            isClientClosed: () => clientClosed
          });
        })
        .catch((error) => {
          sendEvent({
            type: 'audio_error',
            sentence,
            index: itemNumber,
            message: error.message
          });
        });
    }
  });
}

module.exports = {
  registerQuestionRoutes
};
