'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');

const { answerSafetyCases } = require('../tests/answerSafetyCases');
const { buildQuestionContract } = require('../lib/router/questionContract');
const {
  findRelevantKnowledge,
  loadTeacherKnowledge
} = require('../lib/knowledge/teacherKnowledge');
const { buildKnowledgeGraph } = require('../lib/knowledge/knowledgeGraph');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { tryScienceFormula } = require('../lib/formulas/scienceFormulaTools');
const { tryMathOnly } = require('../lib/router/mathCalculator');
const {
  applyRouteValidation,
  validateRouteAgainstContract
} = require('../lib/router/answerContractValidator');
const { createQuestionAnswerService } = require('../lib/server/questionAnswerService');
const { registerQuestionRoutes } = require('../routes/questionRoutes');

const projectRoot = path.join(__dirname, '..');
const teacherFactsFile = path.join(projectRoot, 'knowledge', 'teacher_facts.json');
const initialTeacherKnowledge = loadTeacherKnowledge(teacherFactsFile);
const reviewEntries = [];

const questionAnswer = createQuestionAnswerService({
  teacherFactsFile,
  maxKnowledgeItems: 6,
  loadTeacherKnowledge,
  loadKnowledgeGraph({ teacherKnowledge }) {
    return buildKnowledgeGraph([], teacherKnowledge);
  },
  findRelevantKnowledge,
  routeStudentQuestion,
  ollama: {
    async stream() {
      throw new Error('AI fallback must not be used by deterministic answer-safety regressions.');
    },
    buildTeacherPrompt() {
      return '';
    }
  },
  logProblem(entry) {
    reviewEntries.push(entry);
  },
  logStudentInteraction() {},
  initialTeacherKnowledge,
  initialKnowledgeGraph: buildKnowledgeGraph([], initialTeacherKnowledge)
});

const confidenceRanks = Object.freeze({
  none: 0,
  weak: 1,
  strong: 2
});

const topicAliases = Object.freeze({
  atomic: 'atomic_structure',
  atoms: 'atomic_structure',
  circuit: 'circuits',
  electrical: 'circuits',
  electricity: 'circuits',
  electricity_and_magnetism: 'circuits',
  force: 'forces',
  gravity_and_gravitation: 'gravity',
  gravitation: 'gravity',
  motion_and_force: 'forces',
  motion_and_forces: 'forces',
  motion_force: 'forces',
  newton_laws: 'newtons_laws',
  newtons_law: 'newtons_laws',
  periodic_table: 'atomic_structure'
});

const targetAliases = Object.freeze({
  balanced_force: 'balanced_forces',
  current: 'electric_current',
  earth_gravity: 'earth_surface_gravity',
  electric_current_flow: 'electric_current',
  gpe: 'gravitational_potential_energy',
  gravitational_acceleration: 'earth_surface_gravity',
  lunar_gravity: 'moon_gravity',
  moon_gravitation: 'moon_gravity',
  net_forces: 'net_force',
  newton_first_law: 'newtons_first_law',
  newtons_1st_law: 'newtons_first_law',
  physical_property: 'physical_properties',
  unbalanced_force: 'unbalanced_forces',
  voltage: 'voltage_difference'
});

const unitPatterns = Object.freeze({
  'cm/min': /\bcm\s*(?:\/|per)\s*min(?:ute)?s?\b/i,
  'm/s': /\bm\s*(?:\/|per)\s*s(?:ec(?:ond)?s?)?\b/i,
  'km/h': /\bkm\s*(?:\/|per)\s*h(?:r|our)?s?\b/i,
  mph: /\bmph\b|\bmiles?\s+per\s+hour\b/i,
  J: /\b(?:J|joules?)\b/,
  V: /\bV\b|\bvolts?\b/i,
  'm/s²': /\bm\s*\/\s*s(?:²(?!\w)|\^?2\b)|\bmeters?\s+per\s+second\s+squared\b/i
});

run().catch((error) => {
  console.error('');
  console.error(`Answer-safety runner failed before completing: ${error.stack || error.message}`);
  process.exitCode = 1;
});

async function run() {
  validateFixtureShape(answerSafetyCases);

  const selectedCases = selectCases(answerSafetyCases, process.argv.slice(2));
  const results = [];

  for (const testCase of selectedCases) {
    const observed = {};

    try {
      const directContract = buildQuestionContract(testCase.prompt);
      observed.directContract = summarizeContract(directContract);
      assertContractIsImmutable(directContract, `${testCase.id} direct contract`);
      assertContractMatches(directContract, testCase.expected, `${testCase.id} direct contract`);

      const baseResult = await Promise.resolve(questionAnswer.routeMessage(testCase.prompt));
      observed.base = summarizeResult(baseResult);
      assertServiceMetadata(baseResult, `${testCase.id} routeMessage`);
      assertContractMatches(
        getQuestionContract(baseResult),
        testCase.expected,
        `${testCase.id} routeMessage contract`
      );

      let finalResult = baseResult;
      if (testCase.studentPath) {
        finalResult = await questionAnswer.answerStudentMessage(testCase.prompt, {
          recentMessages: [],
          pendingClarification: null,
          lastAnsweredPrompt: '',
          lastAnsweredAnswer: ''
        });
        observed.student = summarizeResult(finalResult);
        assertServiceMetadata(finalResult, `${testCase.id} answerStudentMessage`);
        assertContractMatches(
          getQuestionContract(finalResult),
          testCase.expected,
          `${testCase.id} answerStudentMessage contract`
        );
      }

      assertFinalResult(finalResult, testCase);
      results.push({ id: testCase.id, passed: true, observed });

      const summary = summarizeResult(finalResult);
      console.log(
        `PASS ${testCase.id} [${testCase.studentPath ? 'student-service' : 'router'}]`
        + ` task=${summary.taskType || 'unknown'}`
        + ` route=${summary.routeType || 'unknown'}`
        + ` confidence=${summary.confidence || 'unknown'}`
      );
    } catch (error) {
      results.push({ id: testCase.id, passed: false, error, observed });
      console.error(`FAIL ${testCase.id} [${testCase.studentPath ? 'student-service' : 'router'}]`);
      console.error(`  prompt: ${testCase.prompt}`);
      console.error(`  ${firstLine(error.message)}`);
      console.error(`  observed: ${JSON.stringify(observed, null, 2).replace(/\n/g, '\n  ')}`);
    }
  }

  const preRetrievalGuardProbeResults = runPreRetrievalGuardProbes();
  const validatorProbeResults = runValidatorAdversarialProbes();
  const studentReleaseProbeResults = await runStudentReleasePathProbes();
  const apiChatProbeResults = await runApiChatIntegrationProbes();
  const failed = results.filter((result) => !result.passed);
  const failedPreRetrievalGuardProbes =
    preRetrievalGuardProbeResults.filter((result) => !result.passed);
  const failedValidatorProbes = validatorProbeResults.filter((result) => !result.passed);
  const failedStudentReleaseProbes =
    studentReleaseProbeResults.filter((result) => !result.passed);
  const failedApiChatProbes = apiChatProbeResults.filter((result) => !result.passed);
  const passedCount = results.length - failed.length;
  const passedPreRetrievalGuardProbeCount =
    preRetrievalGuardProbeResults.length - failedPreRetrievalGuardProbes.length;
  const passedValidatorProbeCount =
    validatorProbeResults.length - failedValidatorProbes.length;
  const passedStudentReleaseProbeCount =
    studentReleaseProbeResults.length - failedStudentReleaseProbes.length;
  const passedApiChatProbeCount =
    apiChatProbeResults.length - failedApiChatProbes.length;

  console.log('');
  console.log(`Answer-safety regressions: ${passedCount} passed, ${failed.length} failed (${results.length} total).`);
  console.log(
    `Pre-retrieval guard probes: ${passedPreRetrievalGuardProbeCount} passed,`
    + ` ${failedPreRetrievalGuardProbes.length} failed`
    + ` (${preRetrievalGuardProbeResults.length} total).`
  );
  console.log(
    `Validator adversarial probes: ${passedValidatorProbeCount} passed,`
    + ` ${failedValidatorProbes.length} failed (${validatorProbeResults.length} total).`
  );
  console.log(
    `Student release-path probes: ${passedStudentReleaseProbeCount} passed,`
    + ` ${failedStudentReleaseProbes.length} failed (${studentReleaseProbeResults.length} total).`
  );
  console.log(
    `/api/chat integration probes: ${passedApiChatProbeCount} passed,`
    + ` ${failedApiChatProbes.length} failed (${apiChatProbeResults.length} total).`
  );
  console.log(`Full student-service cases: ${selectedCases.filter((testCase) => testCase.studentPath).length}.`);
  console.log(`Teacher-review entries captured in memory: ${reviewEntries.length}.`);

  if (
    failed.length > 0 ||
    failedPreRetrievalGuardProbes.length > 0 ||
    failedValidatorProbes.length > 0 ||
    failedStudentReleaseProbes.length > 0 ||
    failedApiChatProbes.length > 0
  ) {
    console.log('');
    console.log('Failing checks:');
    failed.forEach((result) => {
      console.log(`- ${result.id}: ${firstLine(result.error.message)}`);
    });
    failedPreRetrievalGuardProbes.forEach((result) => {
      console.log(`- pre-retrieval:${result.id}: ${firstLine(result.error.message)}`);
    });
    failedValidatorProbes.forEach((result) => {
      console.log(`- validator:${result.id}: ${firstLine(result.error.message)}`);
    });
    failedStudentReleaseProbes.forEach((result) => {
      console.log(`- student-release:${result.id}: ${firstLine(result.error.message)}`);
    });
    failedApiChatProbes.forEach((result) => {
      console.log(`- api-chat:${result.id}: ${firstLine(result.error.message)}`);
    });
    process.exitCode = 1;
  }
}

function runPreRetrievalGuardProbes() {
  const probes = [{
    id: 'generic-correct-answer-wording-requests-missing-choices',
    run() {
      let retrievalCalls = 0;
      let routerCalls = 0;
      const guardService = createQuestionAnswerService({
        teacherFactsFile,
        maxKnowledgeItems: 1,
        loadTeacherKnowledge() {
          return [];
        },
        loadKnowledgeGraph() {
          return null;
        },
        findRelevantKnowledge() {
          retrievalCalls += 1;
          return [];
        },
        routeStudentQuestion() {
          routerCalls += 1;
          throw new Error('Missing-choice guard must run before the general router');
        },
        ollama: {
          async stream() {
            throw new Error('Missing-choice guard must not use AI fallback');
          },
          buildTeacherPrompt() {
            return '';
          }
        },
        logProblem() {},
        logStudentInteraction() {},
        initialTeacherKnowledge: [],
        initialKnowledgeGraph: null
      });

      const result = guardService.routeMessage('Which answer is correct?');
      const answer = getAnswerText(result);
      const contract = getQuestionContract(result);

      assert.equal(retrievalCalls, 0, 'Missing-choice guard must run before knowledge retrieval');
      assert.equal(routerCalls, 0, 'Missing-choice guard must run before the general router');
      assert.equal(contract?.taskType, 'multiple_choice');
      assert.equal(contract?.missingAnswerChoices, true);
      assert.ok(
        asArray(contract?.missingContext).includes('answer_choices'),
        'Contract must record missing answer choices'
      );
      assert.ok(
        getRouteTypes(result).includes('missing_context'),
        'Missing-choice guard must return missing_context'
      );
      assert.equal(normalizeText(getConfidence(result)), 'none');
      assert.ok(/\b(?:provide|share|send|include|need)\b[\s\S]*\bchoices?\b/i.test(answer));

      return {
        routeType: getRouteTypes(result)[0] || '',
        confidence: getConfidence(result),
        retrievalCalls,
        routerCalls
      };
    }
  }];

  console.log('');
  console.log('Pre-retrieval guard probes:');

  return probes.map((probe) => {
    try {
      const observed = probe.run();
      console.log(
        `PASS pre-retrieval:${probe.id}`
        + ` route=${observed.routeType || 'unknown'}`
        + ` confidence=${observed.confidence || 'unknown'}`
        + ` retrievalCalls=${observed.retrievalCalls}`
        + ` routerCalls=${observed.routerCalls}`
      );
      return { id: probe.id, passed: true, observed };
    } catch (error) {
      console.error(`FAIL pre-retrieval:${probe.id}`);
      console.error(`  ${firstLine(error.message)}`);
      return { id: probe.id, passed: false, error };
    }
  });
}

function runValidatorAdversarialProbes() {
  const probes = [
    {
      id: 'force-question-rejects-voltage-candidate',
      run() {
        const prompt = 'A push or pull that causes an object to stop, move, or change direction.';
        const contract = buildQuestionContract(prompt);
        const candidate = buildInjectedCandidate({
          directAnswer:
            'Voltage difference is the push that causes electric charges to move. It is measured in volts.',
          answerTopics: ['circuits'],
          answerConcepts: ['voltage'],
          toolsUsed: ['teacher_facts']
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'validator_adversarial_probe'
        });

        assertRejectedAndReplaced(applied, {
          id: 'force-question-rejects-voltage-candidate',
          forbiddenAnswerPattern: /\bvoltage\b|\bvolts?\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'current-cloze-rejects-conductor-definition',
      run() {
        const prompt = 'The flow of electricity through a conductor is called ____.';
        const contract = buildQuestionContract(prompt);
        const candidate = buildInjectedCandidate({
          directAnswer:
            'A conductor is a material that allows electrons to move through it easily, such as copper.',
          answerTopics: ['circuits'],
          answerConcepts: ['conductor'],
          toolsUsed: ['teacher_facts']
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'validator_adversarial_probe'
        });

        assertRejectedAndReplaced(applied, {
          id: 'current-cloze-rejects-conductor-definition',
          forbiddenAnswerPattern: /^A conductor is\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'stale-graph-metadata-cannot-disguise-periodic-answer',
      run() {
        const prompt = 'Why does an unbalanced force cause an object to accelerate?';
        const contract = buildQuestionContract(prompt);
        const candidate = buildInjectedCandidate({
          type: 'knowledge_graph_answer',
          directAnswer:
            'The periodic table is organized into groups and periods because elements follow repeating patterns.',
          // These deliberately stale labels claim the graph answer is on-topic.
          // Graph use is allowed for this explanation contract, so the
          // substantive answer itself must still cause rejection.
          answerTopics: ['forces'],
          answerConcepts: ['unbalanced_forces'],
          toolsUsed: ['knowledge_graph'],
          graphAnswer: {
            relationship: 'stale_test_relationship',
            sourceNodeId: 'unbalanced-force',
            targetNodeId: 'periodic-table'
          },
          evidence: {
            quality: 'high',
            trust: 'approved_knowledge_graph',
            source: 'knowledge_graph',
            topics: ['forces'],
            concepts: ['unbalanced_forces']
          }
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'graph_replacement_adversarial_probe'
        });

        assert.equal(
          contract.evidenceRequirements.graphReplacementAllowed,
          true,
          'Probe contract must otherwise permit graph replacement'
        );
        assert.equal(
          applied.validation.checks.graphUseAllowed,
          true,
          'Graph policy must not be the reason for rejection'
        );
        assert.equal(
          applied.validation.checks.topicCompatible,
          false,
          'Periodic-table prose must fail substantive topic compatibility despite stale force metadata'
        );
        assert.equal(
          applied.validation.checks.targetConceptSupported,
          false,
          'Periodic-table prose must fail substantive target support despite stale force metadata'
        );
        assert.equal(
          applied.validation.checks.taskFormValid,
          false,
          'Periodic-table prose must fail the requested force explanation'
        );
        assert.ok(
          !applied.validation.reasons.includes('graph_evidence_not_allowed_for_task'),
          'Probe must not fail merely because graph evidence is disallowed'
        );
        assert.ok(
          applied.validation.reasons.includes('graph_answer_text_topic_incompatible_with_question'),
          'Probe must identify the stale graph answer text as topic-incompatible'
        );
        assertRejectedAndReplaced(applied, {
          id: 'stale-graph-metadata-cannot-disguise-periodic-answer',
          forbiddenAnswerPattern: /\bperiodic table\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'low-quality-approved-evidence-cannot-be-strong',
      run() {
        const prompt = 'What is DNA?';
        const contract = buildQuestionContract(prompt);
        const matchedApprovedKnowledge = {
          id: 'approved-pack:biology-probe:dna',
          category: 'approved_vocabulary',
          title: 'DNA',
          subject: 'Biology',
          topic: 'Genetics',
          topics: ['biology'],
          targetConcept: 'DNA',
          fact: 'DNA is a molecule that stores genetic instructions.',
          formula: '',
          examples: [],
          source: 'Approved pack: Biology',
          reviewStatus: 'approved',
          reviewState: 'approved',
          sourceQuality: '',
          confidence: '',
          packId: 'biology-probe',
          provenance: {
            type: 'approved_knowledge_pack',
            packId: 'biology-probe'
          },
          score: 22,
          exactTermMatch: true,
          exactTitleMatch: true,
          strongestPhraseWordCount: 1,
          knowledgeTopics: [],
          knowledgeConcepts: ['DNA']
        };
        const candidate = routeStudentQuestion(
          prompt,
          [matchedApprovedKnowledge],
          contract
        );
        const validation = validateRouteAgainstContract({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [matchedApprovedKnowledge],
          stage: 'approved_evidence_adversarial_probe',
          candidateOrigin: 'base_router'
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [matchedApprovedKnowledge],
          stage: 'approved_evidence_adversarial_probe',
          candidateOrigin: 'base_router'
        });

        assert.equal(validation.valid, true, 'Correct low-quality approved evidence should remain usable');
        assert.equal(validation.confidence, 'weak', 'Low-quality approved evidence must be capped at Weak');
        assert.equal(applied.route.confidence, 'weak', 'Applied low-quality evidence route must remain Weak');
        assert.notEqual(applied.route.confidence, 'strong');
        assert.equal(applied.rejectedRoute, null);
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'no-match-phrase-cannot-produce-strong-wrong-answer',
      run() {
        const prompt = 'A push or pull that causes an object to stop, move, or change direction.';
        const contract = buildQuestionContract(prompt);
        const candidate = buildInjectedCandidate({
          type: 'no_match',
          directAnswer:
            'Voltage difference is the push that causes charge to move and is measured in volts. Please check with your teacher.',
          answerTopics: ['circuits'],
          answerConcepts: ['voltage'],
          toolsUsed: ['teacher_facts']
        });
        const validation = validateRouteAgainstContract({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'safe_no_match_adversarial_probe'
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'safe_no_match_adversarial_probe'
        });

        assertRejectedAndReplaced(applied, {
          id: 'no-match-phrase-cannot-produce-strong-wrong-answer',
          forbiddenAnswerPattern: /\bvoltage\b|\bvolts?\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'same-sentence-no-match-smuggling-is-rejected',
      run() {
        const prompt = 'A push or pull that causes an object to stop, move, or change direction.';
        const contract = buildQuestionContract(prompt);
        const candidate = buildInjectedCandidate({
          type: 'no_match',
          directAnswer:
            'I do not have a trusted answer yet, but force is voltage difference measured in volts.',
          answerTopics: ['forces'],
          answerConcepts: ['force'],
          toolsUsed: ['answer_contract_validator']
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'safe_no_match_smuggling_probe'
        });

        assertRejectedAndReplaced(applied, {
          id: 'same-sentence-no-match-smuggling-is-rejected',
          forbiddenAnswerPattern: /\bvoltage\b|\bvolts?\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'allowlisted-tool-cannot-disguise-wrong-definition',
      run() {
        const prompt = 'What is force?';
        const contract = buildQuestionContract(prompt);
        const candidate = buildInjectedCandidate({
          type: 'definition',
          directAnswer: 'Force is the amount of matter in an object.',
          answerTopics: ['forces'],
          answerConcepts: ['force'],
          toolsUsed: ['motion_force_knowledge']
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'stale_allowlisted_tool_probe'
        });

        assertRejectedAndReplaced(applied, {
          id: 'allowlisted-tool-cannot-disguise-wrong-definition',
          forbiddenAnswerPattern: /\bamount of matter\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'invented-tool-name-is-not-trusted-evidence',
      run() {
        const prompt = 'What is force?';
        const contract = buildQuestionContract(prompt);
        const candidate = buildInjectedCandidate({
          type: 'definition',
          directAnswer: 'A force is a push or pull that can change motion.',
          answerTopics: ['forces'],
          answerConcepts: ['force'],
          toolsUsed: ['totally_invented_rules']
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'invented_tool_probe'
        });

        assertRejectedAndReplaced(applied, {
          id: 'invented-tool-name-is-not-trusted-evidence',
          forbiddenAnswerPattern: /\bforce is a push or pull\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'self-claimed-local-rule-has-no-authority',
      run() {
        const prompt = 'What is force?';
        const contract = buildQuestionContract(prompt);
        const candidate = buildInjectedCandidate({
          type: 'definition',
          directAnswer: 'Force is the color blue that makes an object move.',
          answerTopics: ['forces'],
          answerConcepts: ['force'],
          toolsUsed: ['motion_force_knowledge'],
          evidence: {
            quality: 'high',
            trust: 'local_rule',
            source: 'motion_force_knowledge',
            topics: ['forces'],
            concepts: ['force']
          }
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_local_rule_probe'
        });

        assert.ok(
          applied.validation.reasons.includes('trusted_evidence_required'),
          'A candidate-owned local_rule claim must not establish trust'
        );
        assertRejectedAndReplaced(applied, {
          id: 'self-claimed-local-rule-has-no-authority',
          forbiddenAnswerPattern: /\bcolor blue\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'self-claimed-approved-pack-requires-matched-row',
      run() {
        const prompt = 'What is a conductor in an electric circuit?';
        const contract = buildQuestionContract(prompt);
        const candidate = buildInjectedCandidate({
          type: 'definition',
          directAnswer:
            'A conductor is a material that allows electric charge to move through it easily.',
          answerTopics: ['circuits'],
          answerConcepts: ['conductor'],
          toolsUsed: ['teacher_facts', 'approved_teacher_content'],
          evidence: {
            quality: 'high',
            trust: 'approved_teacher_content',
            source: 'approved_teacher_content',
            knowledgeId: 'approved-pack:missing:conductor',
            reviewStatus: 'approved',
            provenance: {
              type: 'approved_knowledge_pack',
              packId: 'missing-pack'
            },
            topics: ['circuits'],
            concepts: ['conductor']
          }
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_approved_pack_probe',
          candidateOrigin: 'base_router'
        });

        assert.ok(
          applied.validation.reasons.includes('base_router_candidate_not_canonical'),
          'A forged base-router claim must fail canonical route verification before it can claim approval'
        );
        assertRejectedAndReplaced(applied, {
          id: 'self-claimed-approved-pack-requires-matched-row',
          forbiddenAnswerPattern: /^A conductor is\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'base-router-origin-does-not-authorize-injected-answer',
      run() {
        const prompt = 'What is force?';
        const contract = buildQuestionContract(prompt);
        const candidate = buildInjectedCandidate({
          type: 'definition',
          directAnswer: 'Force is the color blue that makes an object move.',
          answerTopics: ['forces'],
          answerConcepts: ['force'],
          toolsUsed: ['motion_force_knowledge'],
          evidence: {
            quality: 'high',
            trust: 'local_rule',
            source: 'motion_force_knowledge',
            topics: ['forces'],
            concepts: ['force']
          }
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_base_router_origin_probe',
          candidateOrigin: 'base_router'
        });

        assert.ok(
          applied.validation.reasons.includes('base_router_candidate_not_canonical'),
          'A base-router origin label must not authorize output that differs from the production router'
        );
        assertRejectedAndReplaced(applied, {
          id: 'base-router-origin-does-not-authorize-injected-answer',
          forbiddenAnswerPattern: /\bcolor blue\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'approved-row-cannot-authorize-forged-answer-or-quality',
      run() {
        const prompt = 'What is DNA?';
        const contract = buildQuestionContract(prompt);
        const matchedApprovedKnowledge = {
          id: 'approved-pack:biology-probe:dna-forgery',
          category: 'approved_vocabulary',
          title: 'DNA',
          subject: 'Biology',
          topic: 'Genetics',
          topics: ['biology'],
          targetConcept: 'DNA',
          fact: 'DNA is a molecule that stores genetic instructions.',
          formula: '',
          examples: [],
          source: 'Approved pack: Biology',
          reviewStatus: 'approved',
          reviewState: 'approved',
          sourceQuality: '',
          confidence: '',
          packId: 'biology-probe',
          provenance: {
            type: 'approved_knowledge_pack',
            packId: 'biology-probe'
          },
          score: 22,
          exactTermMatch: true,
          exactTitleMatch: true,
          strongestPhraseWordCount: 1,
          knowledgeTopics: [],
          knowledgeConcepts: ['DNA']
        };
        const canonical = routeStudentQuestion(
          prompt,
          [matchedApprovedKnowledge],
          contract
        );
        const candidate = {
          ...canonical,
          directAnswer: 'DNA is blue and has no role in genetic instructions.',
          evidence: {
            ...canonical.evidence,
            quality: 'high'
          }
        };
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [matchedApprovedKnowledge],
          stage: 'forged_approved_row_answer_probe',
          candidateOrigin: 'base_router'
        });

        assert.ok(
          applied.validation.reasons.includes('base_router_candidate_not_canonical'),
          'An approved row must not authorize altered answer text or inflated evidence quality'
        );
        assertRejectedAndReplaced(applied, {
          id: 'approved-row-cannot-authorize-forged-answer-or-quality',
          forbiddenAnswerPattern: /\bDNA is blue\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'teacher-approved-rule-output-must-remain-canonical',
      run() {
        const prompt =
          'A push or pull that causes an object to stop, move, or change direction.';
        const contract = buildQuestionContract(prompt);
        const canonical = routeStudentQuestion(prompt, [], contract);
        const candidate = {
          ...canonical,
          directAnswer:
            'The answer is force, but force is also the color blue in this classroom.',
          evidence: {
            ...canonical.evidence,
            quality: 'high'
          }
        };
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_teacher_rule_answer_probe',
          candidateOrigin: 'base_router'
        });

        assert.ok(
          applied.validation.reasons.includes('base_router_candidate_not_canonical'),
          'Teacher-approved rule metadata must bind to the exact production rule output'
        );
        assertRejectedAndReplaced(applied, {
          id: 'teacher-approved-rule-output-must-remain-canonical',
          forbiddenAnswerPattern: /\bcolor blue\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'safe-no-match-strips-forged-answer-metadata',
      run() {
        const prompt = 'What is an unsupported science term?';
        const contract = buildQuestionContract(prompt);
        const safeText =
          'I do not have a trusted answer that matches this question yet. Please check with your teacher.';
        const candidate = {
          type: 'no_match',
          confidence: 'strong',
          directAnswer: safeText,
          toolsUsed: ['answer_contract_validator', 'totally_invented_rules'],
          calculatorResult: { answer: '999' },
          formulaWork: null,
          motionForceTutor: { currentStep: { answer: 'forged' } },
          diagramText: 'forged diagram',
          representationIntent: { kind: 'forged' },
          imageRequest: { prompt: 'forged' },
          answerTopics: ['circuits'],
          answerConcepts: ['voltage'],
          graphAnswer: { directAnswer: 'forged graph answer' },
          rejectedCandidate: { directAnswer: 'private rejected answer' },
          evidence: {
            quality: 'high',
            trust: 'local_rule',
            source: 'forged',
            topics: ['circuits'],
            concepts: ['voltage']
          },
          aiAllowed: false,
          public: {
            type: 'no_match',
            confidence: 'strong',
            toolsUsed: ['science_formula_rules'],
            calculator: { answer: '999' },
            formulaWork: { finalAnswer: { value: 999 } },
            graphAnswer: { directAnswer: 'forged graph answer' },
            rejectedCandidate: { directAnswer: 'private rejected answer' },
            aiAllowed: false
          }
        };
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'safe_no_match_metadata_probe',
          candidateOrigin: 'untrusted'
        });
        const serializedPublic = JSON.stringify(applied.route.public);

        assert.equal(applied.validation.valid, true);
        assert.equal(applied.validation.status, 'safe_no_match');
        assert.equal(applied.route.confidence, 'none');
        assert.equal(applied.route.calculatorResult, null);
        assert.equal(applied.route.formulaWork, null);
        assert.equal(applied.route.motionForceTutor, null);
        assert.equal(applied.route.diagramText, '');
        assert.equal(applied.route.representationIntent, null);
        assert.equal(applied.route.imageRequest, null);
        assert.deepEqual(applied.route.answerTopics, []);
        assert.deepEqual(applied.route.answerConcepts, []);
        assert.deepEqual(applied.route.toolsUsed, ['answer_contract_validator']);
        assert.deepEqual(applied.route.public.toolsUsed, ['answer_contract_validator']);
        assert.doesNotMatch(
          serializedPublic,
          /999|forged|private rejected|calculator|formulaWork|graphAnswer|rejectedCandidate/i
        );
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'missing-choice-clarification-strips-forged-answer-metadata',
      run() {
        const prompt = 'Which answer is correct?';
        const contract = buildQuestionContract(prompt);
        const candidate = {
          type: 'missing_context',
          confidence: 'strong',
          directAnswer: 'Please provide the answer choices so I can evaluate them.',
          toolsUsed: ['question_contract_guard', 'totally_invented_rules'],
          calculatorResult: { answer: '999' },
          formulaWork: { finalAnswer: { value: 999 } },
          diagramText: 'forged diagram',
          answerTopics: ['circuits'],
          answerConcepts: ['voltage'],
          aiAllowed: false,
          public: {
            type: 'missing_context',
            confidence: 'strong',
            toolsUsed: ['science_formula_rules'],
            graphAnswer: { directAnswer: 'forged graph answer' },
            rejectedCandidate: { directAnswer: 'private rejected answer' },
            aiAllowed: false
          }
        };
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'missing_choice_metadata_probe',
          candidateOrigin: 'contract_guard'
        });
        const serializedPublic = JSON.stringify(applied.route.public);

        assert.equal(applied.validation.valid, true);
        assert.equal(applied.validation.status, 'clarification');
        assert.equal(applied.route.confidence, 'none');
        assert.equal(applied.route.calculatorResult, null);
        assert.equal(applied.route.formulaWork, null);
        assert.equal(applied.route.diagramText, '');
        assert.deepEqual(applied.route.answerTopics, []);
        assert.deepEqual(applied.route.answerConcepts, []);
        assert.deepEqual(applied.route.toolsUsed, ['question_contract_guard']);
        assert.deepEqual(applied.route.public.toolsUsed, ['question_contract_guard']);
        assert.doesNotMatch(
          serializedPublic,
          /999|forged|private rejected|calculator|formulaWork|graphAnswer|rejectedCandidate/i
        );
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'approved-pack-id-must-match-resolved-row',
      run() {
        const prompt = 'What is a conductor in an electric circuit?';
        const contract = buildQuestionContract(prompt);
        const matchedKnowledge = {
          id: 'approved-pack:real-pack:conductor',
          category: 'approved_vocabulary',
          title: 'Conductor',
          subject: 'Physical Science',
          topics: ['circuits'],
          targetConcept: 'conductor',
          fact: 'A conductor lets electric charge move through it easily.',
          reviewStatus: 'approved',
          provenance: {
            type: 'approved_knowledge_pack',
            packId: 'real-pack'
          }
        };
        const candidate = buildInjectedCandidate({
          type: 'definition',
          directAnswer:
            'A conductor is a material that allows electric charge to move through it easily.',
          answerTopics: ['circuits'],
          answerConcepts: ['conductor'],
          toolsUsed: ['teacher_facts', 'approved_teacher_content'],
          evidence: {
            quality: 'high',
            trust: 'approved_teacher_content',
            source: 'approved_teacher_content',
            knowledgeId: matchedKnowledge.id,
            reviewStatus: 'approved',
            provenance: {
              type: 'approved_knowledge_pack',
              packId: 'forged-pack'
            },
            topics: ['circuits'],
            concepts: ['conductor']
          }
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [matchedKnowledge],
          stage: 'mismatched_approved_pack_probe',
          candidateOrigin: 'base_router'
        });

        assertRejectedAndReplaced(applied, {
          id: 'approved-pack-id-must-match-resolved-row',
          forbiddenAnswerPattern: /^A conductor is\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'approved-pack-row-must-be-reviewed-approved',
      run() {
        const prompt = 'What is a conductor in an electric circuit?';
        const contract = buildQuestionContract(prompt);
        const matchedKnowledge = {
          id: 'approved-pack:pending-pack:conductor',
          category: 'approved_vocabulary',
          title: 'Conductor',
          subject: 'Physical Science',
          topics: ['circuits'],
          targetConcept: 'conductor',
          fact: 'A conductor lets electric charge move through it easily.',
          reviewStatus: 'pending',
          provenance: {
            type: 'approved_knowledge_pack',
            packId: 'pending-pack'
          }
        };
        const candidate = buildInjectedCandidate({
          type: 'definition',
          directAnswer:
            'A conductor is a material that allows electric charge to move through it easily.',
          answerTopics: ['circuits'],
          answerConcepts: ['conductor'],
          toolsUsed: ['teacher_facts', 'approved_teacher_content'],
          evidence: {
            quality: 'high',
            trust: 'approved_teacher_content',
            source: 'approved_teacher_content',
            knowledgeId: matchedKnowledge.id,
            reviewStatus: 'approved',
            provenance: {
              type: 'approved_knowledge_pack',
              packId: 'pending-pack'
            },
            topics: ['circuits'],
            concepts: ['conductor']
          }
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [matchedKnowledge],
          stage: 'unreviewed_approved_pack_probe',
          candidateOrigin: 'base_router'
        });

        assertRejectedAndReplaced(applied, {
          id: 'approved-pack-row-must-be-reviewed-approved',
          forbiddenAnswerPattern: /^A conductor is\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'graph-claim-requires-server-graph-context',
      run() {
        const prompt = 'Why does an unbalanced force cause an object to accelerate?';
        const contract = buildQuestionContract(prompt);
        const directAnswer =
          'An unbalanced force causes acceleration because a nonzero net force changes motion.';
        const candidate = buildInjectedCandidate({
          type: 'knowledge_graph_answer',
          directAnswer,
          answerTopics: ['forces'],
          answerConcepts: ['unbalanced_forces'],
          toolsUsed: ['knowledge_graph'],
          graphAnswer: {
            type: 'knowledge_graph_answer',
            directAnswer,
            connectedConcepts: ['Unbalanced force', 'Acceleration'],
            source: 'approved_knowledge_graph'
          },
          evidence: {
            quality: 'high',
            trust: 'approved_knowledge_graph',
            source: 'approved_knowledge_graph',
            topics: ['forces'],
            concepts: ['unbalanced_forces']
          }
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_graph_probe',
          candidateOrigin: 'graph_builder',
          graphContext: null
        });

        assert.ok(
          applied.validation.reasons.includes('graph_evidence_context_missing'),
          'Graph authority requires server-supplied graph context'
        );
        assertRejectedAndReplaced(applied, {
          id: 'graph-claim-requires-server-graph-context',
          forbiddenAnswerPattern: /\bnonzero net force\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'graph-ids-must-resolve-in-server-context',
      run() {
        const prompt = 'Why does an unbalanced force cause an object to accelerate?';
        const contract = buildQuestionContract(prompt);
        const directAnswer =
          'An unbalanced force causes acceleration because a nonzero net force changes motion.';
        const candidate = buildInjectedCandidate({
          type: 'knowledge_graph_answer',
          directAnswer,
          answerTopics: ['forces'],
          answerConcepts: ['unbalanced_forces'],
          toolsUsed: ['knowledge_graph'],
          graphAnswer: {
            type: 'knowledge_graph_answer',
            directAnswer,
            graphPath: {
              found: true,
              from: 'concept:forged-force',
              to: 'concept:forged-acceleration',
              length: 1,
              nodes: [
                { id: 'concept:forged-force', type: 'concept', label: 'Force' },
                { id: 'concept:forged-acceleration', type: 'concept', label: 'Acceleration' }
              ],
              edges: [{
                from: 'concept:forged-force',
                to: 'concept:forged-acceleration',
                type: 'related_to',
                label: 'causes'
              }]
            },
            connectedConcepts: ['Force', 'Acceleration'],
            source: 'approved_knowledge_graph'
          },
          evidence: {
            quality: 'high',
            trust: 'approved_knowledge_graph',
            source: 'approved_knowledge_graph',
            topics: ['forces'],
            concepts: ['unbalanced_forces']
          }
        });
        const unrelatedGraphContext = {
          aiAllowed: false,
          matchedNodes: [{
            id: 'concept:periodic-table',
            type: 'concept',
            label: 'Periodic table'
          }],
          relatedNodes: [],
          edges: [],
          possiblePaths: []
        };
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_graph_ids_probe',
          candidateOrigin: 'graph_builder',
          graphContext: unrelatedGraphContext
        });

        assert.ok(
          applied.validation.reasons.includes('graph_payload_node_not_in_context'),
          'Graph IDs must resolve inside the server-supplied graph context'
        );
        assertRejectedAndReplaced(applied, {
          id: 'graph-ids-must-resolve-in-server-context',
          forbiddenAnswerPattern: /\bnonzero net force\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'graph-route-answer-must-match-verified-payload',
      run() {
        const prompt = 'Why does an unbalanced force cause an object to accelerate?';
        const contract = buildQuestionContract(prompt);
        const payloadAnswer =
          'An unbalanced force causes acceleration because a nonzero net force changes motion.';
        const candidate = buildInjectedCandidate({
          type: 'knowledge_graph_answer',
          directAnswer:
            'An unbalanced force causes acceleration because force is the color blue.',
          answerTopics: ['forces'],
          answerConcepts: ['unbalanced_forces', 'acceleration'],
          toolsUsed: ['knowledge_graph'],
          graphAnswer: {
            type: 'knowledge_graph_answer',
            directAnswer: payloadAnswer,
            connectedConcepts: ['Unbalanced force', 'Acceleration'],
            source: 'approved_knowledge_graph'
          },
          evidence: {
            quality: 'high',
            trust: 'approved_knowledge_graph',
            source: 'approved_knowledge_graph',
            topics: ['forces'],
            concepts: ['unbalanced_forces', 'acceleration']
          }
        });
        const graphContext = {
          aiAllowed: false,
          matchedNodes: [
            { id: 'concept:unbalanced-force', type: 'concept', label: 'Unbalanced force' },
            { id: 'concept:acceleration', type: 'concept', label: 'Acceleration' }
          ],
          relatedNodes: [],
          edges: [],
          possiblePaths: []
        };
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_graph_answer_text_probe',
          candidateOrigin: 'graph_builder',
          graphContext
        });

        assert.ok(
          applied.validation.reasons.includes('graph_route_answer_does_not_match_payload'),
          'Released graph answer text must exactly match the graph payload that was verified'
        );
        assertRejectedAndReplaced(applied, {
          id: 'graph-route-answer-must-match-verified-payload',
          forbiddenAnswerPattern: /\bcolor blue\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'formula-final-value-is-recomputed',
      run() {
        const prompt = 'A 10 N force moves a box 3 m. Find the work.';
        const contract = buildQuestionContract(prompt);
        const expected = tryScienceFormula(prompt);
        assert.ok(expected?.formulaWork, 'Formula probe must be recognized by the formula evaluator');
        const forgedFormulaWork = cloneJson(expected.formulaWork);
        forgedFormulaWork.finalAnswer.value = 999;
        forgedFormulaWork.finalAnswer.display = '999 J';
        const candidate = buildInjectedCandidate({
          type: 'science_formula',
          directAnswer: 'Use W = F × d.\nW = 10 N × 3 m\nW = 999 J',
          answerTopics: ['energy'],
          answerConcepts: ['work'],
          toolsUsed: ['science_formula_rules'],
          formulaWork: forgedFormulaWork,
          evidence: {
            quality: 'high',
            trust: 'local_rule',
            source: 'science_formula_rules',
            topics: ['energy'],
            concepts: ['work']
          }
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_formula_value_probe',
          candidateOrigin: 'base_router'
        });

        assert.ok(
          applied.validation.reasons.includes('structured_formula_does_not_match_question'),
          'Formula final values must be independently recomputed'
        );
        assertRejectedAndReplaced(applied, {
          id: 'formula-final-value-is-recomputed',
          forbiddenAnswerPattern: /\b999 J\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'formula-id-and-givens-are-recomputed',
      run() {
        const prompt = 'A 10 N force moves a box 3 m. Find the work.';
        const contract = buildQuestionContract(prompt);
        const expected = tryScienceFormula(prompt);
        assert.ok(expected?.formulaWork, 'Formula probe must be recognized by the formula evaluator');
        const forgedFormulaWork = cloneJson(expected.formulaWork);
        forgedFormulaWork.formulaId = 'invented_work_formula';
        forgedFormulaWork.variables.force.value = 999;
        forgedFormulaWork.variables.force.display = '999 N';
        const candidate = buildInjectedCandidate({
          type: 'science_formula',
          directAnswer: expected.answer,
          answerTopics: ['energy'],
          answerConcepts: ['work'],
          toolsUsed: ['science_formula_rules'],
          formulaWork: forgedFormulaWork,
          evidence: {
            quality: 'high',
            trust: 'local_rule',
            source: 'science_formula_rules',
            topics: ['energy'],
            concepts: ['work']
          }
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_formula_shape_probe',
          candidateOrigin: 'base_router'
        });

        assert.ok(
          applied.validation.reasons.includes('structured_formula_does_not_match_question'),
          'Formula IDs and given values must match the independent evaluator'
        );
        assertRejectedAndReplaced(applied, {
          id: 'formula-id-and-givens-are-recomputed',
          forbiddenAnswerPattern: /\bW = 30 J\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'formula-wrong-unit-is-rejected',
      run() {
        const prompt = 'A 10 N force moves a box 3 m. Find the work.';
        const contract = buildQuestionContract(prompt);
        const canonical = routeStudentQuestion(prompt, [], contract);
        assert.ok(canonical?.formulaWork, 'Wrong-unit probe must start from a canonical formula route');
        const candidate = cloneJson(canonical);
        candidate.formulaWork.finalAnswer.unit = 'N';
        candidate.formulaWork.finalAnswer.display = '30 N';
        candidate.directAnswer = candidate.directAnswer.replace(/\b30 J\b/g, '30 N');
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_formula_unit_probe',
          candidateOrigin: 'base_router'
        });

        assert.ok(
          applied.validation.reasons.includes('calculation_missing_requested_unit'),
          'A numerically correct answer with the wrong unit must be rejected'
        );
        assert.ok(
          applied.validation.reasons.includes('structured_formula_does_not_match_question'),
          'Structured formula units must match independent recomputation'
        );
        assertRejectedAndReplaced(applied, {
          id: 'formula-wrong-unit-is-rejected',
          forbiddenAnswerPattern: /\b30 N\b/
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'formula-correct-number-with-wrong-formula-is-rejected',
      run() {
        const prompt = 'A 10 N force moves a box 3 m. Find the work.';
        const contract = buildQuestionContract(prompt);
        const canonical = routeStudentQuestion(prompt, [], contract);
        assert.ok(canonical?.formulaWork, 'Wrong-formula probe must start from a canonical formula route');
        const candidate = cloneJson(canonical);
        candidate.formulaWork.formula = 'W = F + d';
        candidate.directAnswer = candidate.directAnswer.replace(/W = F × d/g, 'W = F + d');
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_formula_identity_probe',
          candidateOrigin: 'base_router'
        });

        assert.ok(
          applied.validation.reasons.includes('structured_formula_does_not_match_question'),
          'A correct number derived from the wrong formula identity must be rejected'
        );
        assertRejectedAndReplaced(applied, {
          id: 'formula-correct-number-with-wrong-formula-is-rejected',
          forbiddenAnswerPattern: /\bW = F \+ d\b/
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'calculator-result-is-recomputed',
      run() {
        const prompt = 'What is 2 + 2?';
        const contract = buildQuestionContract(prompt);
        const expected = tryMathOnly(prompt);
        assert.ok(expected, 'Calculator probe must be recognized by the local calculator');
        const forgedCalculator = {
          ...expected,
          value: 999,
          displayValue: '999',
          answer: '2 + 2 = 999.'
        };
        const candidate = buildInjectedCandidate({
          type: 'math_only',
          directAnswer: '2 + 2 = 999.',
          answerTopics: [],
          answerConcepts: [],
          toolsUsed: ['calculator', 'mathjs'],
          calculatorResult: forgedCalculator,
          evidence: null
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_calculator_probe',
          candidateOrigin: 'base_router'
        });

        assert.ok(
          applied.validation.reasons.includes('calculator_result_does_not_match_question'),
          'Calculator results must be independently recomputed'
        );
        assertRejectedAndReplaced(applied, {
          id: 'calculator-result-is-recomputed',
          forbiddenAnswerPattern: /\b999\b/
        });
        return summarizeAppliedValidation(applied);
      }
    },
    {
      id: 'arbitrary-followup-cannot-self-bind',
      run() {
        const prompt = 'Why does that matter?';
        const contract = {
          taskType: 'contextual_followup',
          candidateTopics: ['forces'],
          targetConcept: '',
          missingContext: [],
          evidenceRequirements: {
            trustedEvidenceRequired: true,
            compatibleTopicRequired: false,
            targetConceptSupportRequired: false,
            graphEvidenceAllowed: false,
            graphReplacementAllowed: false
          }
        };
        const candidate = buildInjectedCandidate({
          type: 'standards_followup',
          directAnswer: 'It matters because force is secretly the color blue.',
          answerTopics: ['forces'],
          answerConcepts: [],
          toolsUsed: ['resolved_followup_rules'],
          evidence: {
            quality: 'high',
            trust: 'local_rule',
            source: 'resolved_followup',
            topics: ['forces'],
            concepts: []
          }
        });
        const applied = applyRouteValidation({
          message: prompt,
          contract,
          route: candidate,
          matchedKnowledge: [],
          stage: 'forged_followup_probe'
        });

        assertRejectedAndReplaced(applied, {
          id: 'arbitrary-followup-cannot-self-bind',
          forbiddenAnswerPattern: /\bcolor blue\b/i
        });
        return summarizeAppliedValidation(applied);
      }
    }
  ];

  console.log('');
  console.log('Validator-level adversarial probes:');

  return probes.map((probe) => {
    try {
      const observed = probe.run();
      console.log(
        `PASS validator:${probe.id}`
        + ` status=${observed.status || 'unknown'}`
        + ` confidence=${observed.confidence || 'unknown'}`
        + ` replacement=${observed.replaced ? 'yes' : 'no'}`
      );
      return { id: probe.id, passed: true, observed };
    } catch (error) {
      console.error(`FAIL validator:${probe.id}`);
      console.error(`  ${firstLine(error.message)}`);
      return { id: probe.id, passed: false, error };
    }
  });
}

async function runStudentReleasePathProbes() {
  const probes = [
    {
      id: 'injected-base-router-output-fails-closed',
      async run() {
        const internalReviewEntries = [];
        const injectedRouterService = createQuestionAnswerService({
          teacherFactsFile,
          maxKnowledgeItems: 1,
          loadTeacherKnowledge() {
            return [];
          },
          loadKnowledgeGraph() {
            return null;
          },
          findRelevantKnowledge() {
            return [];
          },
          routeStudentQuestion() {
            return buildInjectedCandidate({
              type: 'definition',
              directAnswer: 'Force is the color blue that makes an object move.',
              answerTopics: ['forces'],
              answerConcepts: ['force'],
              toolsUsed: ['motion_force_knowledge'],
              evidence: {
                quality: 'high',
                trust: 'local_rule',
                source: 'motion_force_knowledge',
                topics: ['forces'],
                concepts: ['force']
              }
            });
          },
          ollama: {
            async stream() {
              throw new Error('Rejected injected router output must not reach AI fallback');
            },
            buildTeacherPrompt() {
              return '';
            }
          },
          logProblem(entry) {
            internalReviewEntries.push(entry);
          },
          logStudentInteraction() {},
          initialTeacherKnowledge: [],
          initialKnowledgeGraph: null
        });
        const result = await injectedRouterService.answerStudentMessage(
          'What is force?',
          {
            recentMessages: [],
            pendingClarification: null,
            lastAnsweredPrompt: '',
            lastAnsweredAnswer: ''
          }
        );

        assert.equal(result.routeType, 'no_match');
        assert.equal(normalizeText(result.confidence), 'none');
        assert.doesNotMatch(getAnswerText(result), /\bcolor blue\b/i);
        assert.ok(
          asArray(result.answerValidation?.reasons)
            .includes('base_router_candidate_not_canonical'),
          'Student release path must reject an injected route that differs from the canonical router'
        );
        assert.ok(
          internalReviewEntries.some((entry) => entry.category === 'answer_contract_rejection'),
          'Rejected injected output must be retained for internal teacher review'
        );

        return {
          routeType: result.routeType,
          confidence: result.confidence
        };
      }
    },
    {
      id: 'wave-water-chemistry-hijacks-fail-closed',
      async run() {
        const prompts = [
          'Why does a pencil look broken in water?',
          'what do objects look bent in water',
          'why did the my finger look like it was crocket when I put it in a glass of water',
          'In a wave tank, the current makes the water waves move. Is this electrical current?'
        ];
        const outcomes = [];

        for (const prompt of prompts) {
          const result = await questionAnswer.answerStudentMessage(prompt, {
            recentMessages: [],
            pendingClarification: null,
            lastAnsweredPrompt: '',
            lastAnsweredAnswer: ''
          });
          const answer = getAnswerText(result);

          assert.equal(
            result.routeType,
            'no_match',
            `Known water-context hijack must fail closed: ${prompt}`
          );
          assert.equal(
            normalizeText(result.confidence),
            'none',
            `Known water-context hijack must not retain answer confidence: ${prompt}`
          );
          assert.doesNotMatch(
            answer,
            /\bH2O\b|\bcovalent\b|\bhydrogen\b|\boxygen\b|\bchemical formula\b/i,
            `Student release path must not expose the legacy chemistry hijack: ${prompt}`
          );
          outcomes.push({
            prompt,
            routeType: result.routeType,
            confidence: result.confidence
          });
        }

        return {
          routeType: outcomes.every((outcome) => outcome.routeType === 'no_match')
            ? 'no_match'
            : 'mixed',
          confidence: outcomes.every((outcome) => normalizeText(outcome.confidence) === 'none')
            ? 'none'
            : 'mixed'
        };
      }
    }
  ];

  console.log('');
  console.log('Student release-path probes:');

  const results = [];
  for (const probe of probes) {
    try {
      const observed = await probe.run();
      console.log(
        `PASS student-release:${probe.id}`
        + ` route=${observed.routeType || 'unknown'}`
        + ` confidence=${observed.confidence || 'unknown'}`
      );
      results.push({ id: probe.id, passed: true, observed });
    } catch (error) {
      console.error(`FAIL student-release:${probe.id}`);
      console.error(`  ${firstLine(error.message)}`);
      results.push({ id: probe.id, passed: false, error });
    }
  }
  return results;
}

async function runApiChatIntegrationProbes() {
  const probes = [{
    id: 'ai-fallback-is-buffered-until-validation',
    async run() {
      const modelText =
        'Voltage is the color blue, and that is definitely the definition of force.';
      const internalReviewEntries = [];
      let receivedSignal = null;
      const maliciousFallbackService = createQuestionAnswerService({
        teacherFactsFile,
        maxKnowledgeItems: 1,
        loadTeacherKnowledge() {
          return [];
        },
        loadKnowledgeGraph() {
          return null;
        },
        findRelevantKnowledge() {
          return [];
        },
        routeStudentQuestion() {
          const safeNoMatch =
            'I do not have a trusted answer that matches this question yet. Please check with your teacher.';
          return {
            type: 'no_match',
            confidence: 'none',
            directAnswer: safeNoMatch,
            toolsUsed: ['answer_contract_validator'],
            answerTopics: [],
            answerConcepts: [],
            evidence: null,
            aiAllowed: true,
            public: {
              type: 'no_match',
              confidence: 'none',
              toolsUsed: ['answer_contract_validator'],
              aiAllowed: true
            }
          };
        },
        ollama: {
          async stream({ onText, signal }) {
            receivedSignal = signal;
            onText(modelText);
          },
          buildTeacherPrompt() {
            return 'test-only prompt';
          }
        },
        logProblem(entry) {
          internalReviewEntries.push(entry);
        },
        logStudentInteraction() {},
        initialTeacherKnowledge: [],
        initialKnowledgeGraph: null
      });
      const handlers = new Map();
      const app = {
        get(routePath, handler) {
          handlers.set(`GET ${routePath}`, handler);
        },
        post(routePath, handler) {
          handlers.set(`POST ${routePath}`, handler);
        }
      };
      registerQuestionRoutes(app, {
        ollama: {},
        questionAnswer: maliciousFallbackService,
        tts: {
          getEffectiveTtsBackend() {
            return 'disabled';
          },
          getEffectiveAudioMode() {
            return 'disabled';
          },
          canStreamAudio() {
            return false;
          },
          async streamSentenceAudio() {}
        }
      });

      const handler = handlers.get('POST /api/chat');
      assert.equal(typeof handler, 'function', '/api/chat handler must be registered');
      const request = new EventEmitter();
      request.body = {
        message: 'What is force?',
        voice: ''
      };
      const chunks = [];
      const response = new EventEmitter();
      response.writableEnded = false;
      response.setHeader = () => {};
      response.status = () => response;
      response.json = (payload) => {
        chunks.push(JSON.stringify(payload));
        response.writableEnded = true;
      };
      response.write = (chunk) => {
        chunks.push(String(chunk));
        return true;
      };
      response.end = () => {
        response.writableEnded = true;
      };

      await handler(request, response);

      const events = chunks
        .join('')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const textEvents = events.filter((event) => event.type === 'text_delta');
      const routerEvent = events.find((event) => event.type === 'router');
      const doneEvent = events.find((event) => event.type === 'done');
      const serializedPublicRouter = JSON.stringify(routerEvent?.router || {});

      assert.equal(textEvents.length, 1, '/api/chat must emit one validated text payload');
      assert.equal(
        textEvents[0].chunk,
        'I do not have a trusted answer that matches this question yet. Please check with your teacher.',
        '/api/chat must emit the validator replacement instead of rejected AI text'
      );
      assert.doesNotMatch(
        textEvents[0].chunk,
        /voltage|color blue/i,
        'Rejected AI text must never reach text_delta'
      );
      assert.equal(doneEvent?.fullText, textEvents[0].chunk);
      assert.doesNotMatch(
        serializedPublicRouter,
        /voltage|color blue|rejectedRoute|rejectedCandidate|answerValidation|questionContract/i,
        'Rejected candidates and internal validation metadata must not appear in public router metadata'
      );
      assert.ok(
        receivedSignal instanceof AbortSignal,
        '/api/chat must pass its cancellation signal through the service to the model stream'
      );
      assert.ok(
        internalReviewEntries.some((entry) => entry.category === 'answer_contract_rejection'),
        'The rejected AI candidate must still be retained in internal review logging'
      );

      return {
        textDelta: textEvents[0].chunk,
        publicRouteType: routerEvent?.router?.type || '',
        rejectedTextExposed: serializedPublicRouter.includes(modelText)
      };
    }
  }];

  console.log('');
  console.log('/api/chat release-path integration probes:');

  const results = [];
  for (const probe of probes) {
    try {
      const observed = await probe.run();
      console.log(`PASS api-chat:${probe.id} route=${observed.publicRouteType || 'unknown'}`);
      results.push({ id: probe.id, passed: true, observed });
    } catch (error) {
      console.error(`FAIL api-chat:${probe.id}`);
      console.error(`  ${firstLine(error.message)}`);
      results.push({ id: probe.id, passed: false, error });
    }
  }
  return results;
}

function buildInjectedCandidate({
  type = 'class_fact',
  directAnswer,
  answerTopics,
  answerConcepts,
  toolsUsed,
  evidence = null,
  graphAnswer = null,
  formulaWork = null,
  calculatorResult = null
}) {
  const routeEvidence = evidence || {
    quality: 'high',
    trust: 'teacher_approved_local_fact',
    source: 'teacher_facts',
    topics: [...answerTopics],
    concepts: [...answerConcepts]
  };

  return {
    type,
    confidence: 'strong',
    directAnswer,
    toolsUsed: [...toolsUsed],
    answerTopics: [...answerTopics],
    answerConcepts: [...answerConcepts],
    evidence: routeEvidence,
    graphAnswer,
    formulaWork,
    calculatorResult,
    aiAllowed: false,
    public: {
      type,
      confidence: 'strong',
      toolsUsed: [...toolsUsed],
      aiAllowed: false
    }
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertRejectedAndReplaced(applied, { id, forbiddenAnswerPattern }) {
  assert.equal(applied.validation.valid, false, `${id} candidate must fail validation`);
  assert.equal(applied.validation.confidence, 'none', `${id} rejected confidence must be None`);
  assert.ok(applied.rejectedRoute, `${id} must retain the rejected candidate for teacher review`);
  assert.equal(applied.route.type, 'no_match', `${id} must fail closed to no_match`);
  assert.equal(applied.route.confidence, 'none', `${id} safe replacement must have None confidence`);
  assert.equal(applied.route.aiAllowed, false, `${id} safe replacement must not enable AI fallback`);
  assert.doesNotMatch(
    String(applied.route.directAnswer || ''),
    forbiddenAnswerPattern,
    `${id} must not expose the rejected candidate text`
  );
}

function summarizeAppliedValidation(applied) {
  return {
    valid: Boolean(applied.validation?.valid),
    status: String(applied.validation?.status || ''),
    reason: String(applied.validation?.reason || ''),
    reasons: asArray(applied.validation?.reasons),
    confidence: String(applied.route?.confidence || applied.validation?.confidence || ''),
    routeType: String(applied.route?.type || ''),
    replaced: Boolean(applied.rejectedRoute)
  };
}

function validateFixtureShape(cases) {
  assert.ok(Array.isArray(cases) && cases.length > 0, 'answerSafetyCases must be a non-empty array');

  const ids = new Set();
  const approvedExpectations = new Set();
  const requiredExpectedFields = [
    'taskType',
    'candidateTopics',
    'targetConcept',
    'clarificationRequired',
    'maxConfidence',
    'allowedRouteTypes'
  ];

  for (const testCase of cases) {
    assert.equal(typeof testCase.id, 'string', 'Every answer-safety case needs an id');
    assert.ok(!ids.has(testCase.id), `Duplicate answer-safety case id: ${testCase.id}`);
    ids.add(testCase.id);
    assert.equal(typeof testCase.prompt, 'string', `${testCase.id} needs a prompt`);
    assert.equal(typeof testCase.studentPath, 'boolean', `${testCase.id} needs an explicit studentPath flag`);
    assert.ok(testCase.expected && typeof testCase.expected === 'object', `${testCase.id} needs expected`);

    requiredExpectedFields.forEach((field) => {
      assert.ok(
        Object.prototype.hasOwnProperty.call(testCase.expected, field),
        `${testCase.id} expected.${field} is required`
      );
    });

    for (const arrayField of [
      'candidateTopics',
      'requiredAnswerPatterns',
      'forbiddenAnswerPatterns',
      'requiredUnits',
      'forbiddenUnits',
      'requiredTools',
      'forbiddenTools',
      'allowedRouteTypes'
    ]) {
      if (!Object.prototype.hasOwnProperty.call(testCase.expected, arrayField)) continue;
      assert.ok(Array.isArray(testCase.expected[arrayField]), `${testCase.id} expected.${arrayField} must be an array`);
    }

    const approvedMatch = String(testCase.expectation || '').match(/^([A-O])(?:\b|;)/);
    if (approvedMatch) approvedExpectations.add(approvedMatch[1]);
  }

  for (const expectation of 'ABCDEFGHIJKLMNO') {
    assert.ok(
      approvedExpectations.has(expectation),
      `Teacher-approved expectation ${expectation} is missing from answerSafetyCases`
    );
  }
}

function selectCases(cases, filters) {
  if (!filters.length) return cases;

  const normalizedFilters = filters
    .filter((filter) => filter !== '--case')
    .map((filter) => normalizeText(filter))
    .filter(Boolean);
  const selected = cases.filter((testCase) => normalizedFilters.some((filter) => (
    normalizeText(testCase.id).includes(filter)
    || normalizeText(testCase.expectation).includes(filter)
  )));

  assert.ok(selected.length > 0, `No answer-safety cases matched: ${filters.join(' ')}`);
  return selected;
}

function assertContractIsImmutable(contract, label) {
  assert.ok(contract && typeof contract === 'object', `${label} must be an object`);
  assert.ok(Object.isFrozen(contract), `${label} must be immutable with Object.freeze()`);

  for (const field of [
    'candidateTopics',
    'suppliedAnswerChoices',
    'numericalGivens',
    'requestedUnits',
    'missingContext',
    'evidenceRequirements'
  ]) {
    if (!Array.isArray(contract[field])) continue;
    assert.ok(Object.isFrozen(contract[field]), `${label}.${field} must be frozen`);
  }
}

function assertServiceMetadata(result, label) {
  const contract = getQuestionContract(result);
  const validation = getAnswerValidation(result);

  assert.ok(contract && typeof contract === 'object', `${label} must return questionContract`);
  assert.ok(validation && typeof validation === 'object', `${label} must return answerValidation`);
  assertContractIsImmutable(contract, `${label}.questionContract`);
}

function assertContractMatches(contract, expected, label) {
  assert.ok(contract && typeof contract === 'object', `${label} is missing`);

  const actualTaskType = normalizeText(contract.taskType || contract.task);
  const expectedTaskTypes = asArray(expected.taskType).map(normalizeText);
  assert.ok(
    expectedTaskTypes.includes(actualTaskType),
    `${label}.taskType expected ${expectedTaskTypes.join(' or ')}, got ${actualTaskType || '(empty)'}`
  );

  const actualTopics = asArray(contract.candidateTopics || contract.topics)
    .map(topicValue)
    .map(canonicalTopic)
    .filter(Boolean);
  const expectedTopics = asArray(expected.candidateTopics).map(canonicalTopic);
  for (const expectedTopic of expectedTopics) {
    assert.ok(
      actualTopics.includes(expectedTopic),
      `${label}.candidateTopics expected ${expectedTopic}; got ${actualTopics.join(', ') || '(empty)'}`
    );
  }

  const actualTarget = canonicalTarget(
    contract.targetConcept
    || contract.target
    || contract.requestedConcept
  );
  const expectedTargets = asArray(expected.targetConcept).map(canonicalTarget);
  assert.ok(
    expectedTargets.includes(actualTarget),
    `${label}.targetConcept expected ${expectedTargets.join(' or ')}, got ${actualTarget || '(empty)'}`
  );
}

function assertFinalResult(result, testCase) {
  const { expected } = testCase;
  const answer = getAnswerText(result);
  const routeTypes = getRouteTypes(result);
  const confidence = getConfidence(result);
  const tools = getTools(result);
  const contract = getQuestionContract(result);
  const validation = getAnswerValidation(result);

  assert.ok(answer.trim(), `${testCase.id} returned an empty answer`);

  for (const pattern of expected.requiredAnswerPatterns || []) {
    assertPatternMatches(
      answer,
      pattern,
      `${testCase.id} answer must match ${formatPattern(pattern)}`
    );
  }
  for (const pattern of expected.forbiddenAnswerPatterns || []) {
    assertPatternDoesNotMatch(
      answer,
      pattern,
      `${testCase.id} answer must not match ${formatPattern(pattern)}`
    );
  }

  const unitText = getUnitText(result);
  for (const unit of expected.requiredUnits || []) {
    assertPatternMatches(
      unitText,
      patternForUnit(unit),
      `${testCase.id} answer/formula must include unit ${formatPattern(unit)}`
    );
  }
  for (const unit of expected.forbiddenUnits || []) {
    assertPatternDoesNotMatch(
      unitText,
      patternForUnit(unit),
      `${testCase.id} answer/formula must not include unit ${formatPattern(unit)}`
    );
  }

  for (const requiredTool of expected.requiredTools || []) {
    assert.ok(
      tools.some((tool) => valueMatches(tool, requiredTool)),
      `${testCase.id} expected tool ${formatPattern(requiredTool)}; got ${tools.join(', ') || '(none)'}`
    );
  }
  for (const forbiddenTool of expected.forbiddenTools || []) {
    assert.ok(
      !tools.some((tool) => valueMatches(tool, forbiddenTool)),
      `${testCase.id} forbids tool ${formatPattern(forbiddenTool)}; got ${tools.join(', ') || '(none)'}`
    );
  }

  assert.ok(
    routeTypes.some((routeType) => expected.allowedRouteTypes.map(normalizeText).includes(normalizeText(routeType))),
    `${testCase.id} route expected one of ${expected.allowedRouteTypes.join(', ')}; got ${routeTypes.join(', ') || '(none)'}`
  );

  const confidenceRank = confidenceRanks[normalizeText(confidence)];
  const maxConfidenceRank = confidenceRanks[normalizeText(expected.maxConfidence)];
  assert.notEqual(confidenceRank, undefined, `${testCase.id} returned unknown confidence: ${confidence}`);
  assert.notEqual(maxConfidenceRank, undefined, `${testCase.id} has invalid maxConfidence: ${expected.maxConfidence}`);
  assert.ok(
    confidenceRank <= maxConfidenceRank,
    `${testCase.id} confidence ${confidence} exceeds maximum ${expected.maxConfidence}`
  );

  assertClarificationState({
    answer,
    contract,
    validation,
    result,
    required: expected.clarificationRequired,
    label: testCase.id
  });
}

function assertClarificationState({ answer, contract, validation, result, required, label }) {
  const explicitMissingSignal = Boolean(
    contract?.missingAnswerChoices
    || contract?.requiresUnseenDiagram
    || contract?.unseenDiagramRequired
    || hasMissingContext(contract?.missingContext)
    || validation?.requiresClarification
    || validation?.missingContext
    || result?.pendingClarification
  );
  const answerRequestsContext = (
    /\b(?:provide|share|send|include|upload|show|need)\b[\s\S]*\b(?:choices?|diagram|image|context)\b/i.test(answer)
    || /\bwhat are the choices\b/i.test(answer)
    || /\bdescribe\b[\s\S]*\b(?:diagram|circuit)\b/i.test(answer)
  );

  if (required) {
    assert.ok(explicitMissingSignal, `${label} contract/validation must record missing context`);
    assert.ok(answerRequestsContext, `${label} must ask the student for the missing context`);
    return;
  }

  assert.ok(!contract?.missingAnswerChoices, `${label} must not mark answer choices missing`);
  assert.ok(
    !contract?.requiresUnseenDiagram && !contract?.unseenDiagramRequired,
    `${label} must not mark an unseen diagram required`
  );
  assert.ok(!hasMissingContext(contract?.missingContext), `${label} must not report unresolved missing context`);
}

function getQuestionContract(result) {
  return result?.questionContract
    || result?.questionRoute?.questionContract
    || result?.public?.questionContract
    || result?.questionRoute?.public?.questionContract
    || null;
}

function getAnswerValidation(result) {
  return result?.answerValidation
    || result?.questionRoute?.answerValidation
    || result?.public?.answerValidation
    || result?.questionRoute?.public?.answerValidation
    || null;
}

function getAnswerText(result) {
  return String(
    result?.response
    || result?.questionRoute?.directAnswer
    || result?.directAnswer
    || ''
  );
}

function getRouteTypes(result) {
  return uniqueStrings([
    result?.routeType,
    result?.type,
    result?.public?.type,
    result?.questionRoute?.type,
    result?.questionRoute?.public?.type
  ]);
}

function getConfidence(result) {
  return String(
    result?.confidence
    || result?.questionRoute?.confidence
    || result?.questionRoute?.public?.confidence
    || ''
  );
}

function getTools(result) {
  return uniqueStrings([
    ...asArray(result?.toolsUsed),
    ...asArray(result?.public?.toolsUsed),
    ...asArray(result?.questionRoute?.toolsUsed),
    ...asArray(result?.questionRoute?.public?.toolsUsed)
  ]);
}

function getUnitText(result) {
  const route = result?.questionRoute || result;
  const formulaWork = route?.formulaWork || {};
  return [
    getAnswerText(result),
    formulaWork?.finalAnswer?.unit,
    formulaWork?.finalAnswer?.display,
    formulaWork?.resultUnit,
    formulaWork?.requestedUnit
  ].filter(Boolean).join('\n');
}

function summarizeResult(result) {
  const contract = getQuestionContract(result);
  return {
    taskType: contract?.taskType || contract?.task || '',
    candidateTopics: contract?.candidateTopics || contract?.topics || [],
    targetConcept: contract?.targetConcept || contract?.target || '',
    routeType: getRouteTypes(result)[0] || '',
    confidence: getConfidence(result),
    toolsUsed: getTools(result),
    answer: truncate(getAnswerText(result), 240),
    answerValidation: summarizeValidation(getAnswerValidation(result))
  };
}

function summarizeContract(contract) {
  if (!contract || typeof contract !== 'object') return null;
  return {
    taskType: contract.taskType || contract.task || '',
    candidateTopics: contract.candidateTopics || contract.topics || [],
    targetConcept: contract.targetConcept || contract.target || '',
    missingAnswerChoices: Boolean(contract.missingAnswerChoices),
    requiresUnseenDiagram: Boolean(
      contract.requiresUnseenDiagram || contract.unseenDiagramRequired
    ),
    missingContext: contract.missingContext
  };
}

function summarizeValidation(validation) {
  if (!validation || typeof validation !== 'object') return null;
  return {
    valid: firstDefined(validation.valid, validation.isValid, validation.passed),
    reason: validation.reason || validation.code || validation.status || '',
    reasons: validation.reasons || validation.failures || []
  };
}

function hasMissingContext(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

function patternForUnit(unit) {
  if (unit instanceof RegExp) return unit;
  const key = String(unit);
  return unitPatterns[key] || new RegExp(`\\b${escapeRegExp(key)}\\b`, 'i');
}

function assertPatternMatches(value, pattern, message) {
  assert.ok(testPattern(value, pattern), `${message}; got:\n${value}`);
}

function assertPatternDoesNotMatch(value, pattern, message) {
  assert.ok(!testPattern(value, pattern), `${message}; got:\n${value}`);
}

function testPattern(value, pattern) {
  if (pattern instanceof RegExp) {
    return new RegExp(pattern.source, pattern.flags).test(String(value));
  }
  return String(value).toLowerCase().includes(String(pattern).toLowerCase());
}

function valueMatches(value, expected) {
  if (expected instanceof RegExp) return testPattern(value, expected);
  return normalizeText(value) === normalizeText(expected);
}

function topicValue(topic) {
  if (topic && typeof topic === 'object') {
    return topic.id || topic.topic || topic.name || topic.label || '';
  }
  return topic;
}

function canonicalTopic(value) {
  const normalized = normalizeText(value);
  return topicAliases[normalized] || normalized;
}

function canonicalTarget(value) {
  const normalized = normalizeText(value);
  return targetAliases[normalized] || normalized;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null).map(String).filter(Boolean))];
}

function formatPattern(value) {
  return value instanceof RegExp ? value.toString() : JSON.stringify(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncate(value, maxLength) {
  const text = String(value || '');
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined);
}

function firstLine(value) {
  return String(value || '').split('\n')[0];
}
