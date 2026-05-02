function registerAiImprovementRoutes(app, { getProblems, logProblem, updateProblem }) {
  app.get('/api/ai-improvement/problems', (_req, res) => {
    const problems = getProblems()
      .slice()
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    res.json({ problems });
  });

  app.post('/api/ai-improvement/problems', (req, res) => {
    const problem = logProblem({
      status: req.body?.status || 'open',
      category: req.body?.category || 'needs_review',
      studentQuestion: req.body?.studentQuestion || '',
      answerGiven: req.body?.answerGiven || '',
      routerType: req.body?.routerType || '',
      formulaChosen: req.body?.formulaChosen || '',
      confidence: req.body?.confidence || '',
      expectedBehavior: req.body?.expectedBehavior || '',
      teacherNotes: req.body?.teacherNotes || '',
      source: req.body?.source || '',
      reason: req.body?.reason || '',
      debug: req.body?.debug || {}
    });

    res.status(201).json({ problem });
  });

  app.patch('/api/ai-improvement/problems/:id', (req, res) => {
    const problem = updateProblem(req.params.id, {
      status: req.body?.status,
      category: req.body?.category,
      teacherNotes: req.body?.teacherNotes,
      expectedBehavior: req.body?.expectedBehavior,
      source: req.body?.source,
      reason: req.body?.reason
    });

    if (!problem) {
      return res.status(404).json({ error: 'Problem not found.' });
    }

    res.json({ problem });
  });
}

module.exports = {
  registerAiImprovementRoutes
};
