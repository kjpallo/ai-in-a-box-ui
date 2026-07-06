const DEMO_SAME_OR_DIFFERENT_PATTERN = {
  id: 'demo.same-or-different',
  topic: 'same or different',
  originalQuestion: 'Is this all the same or different?',
  steps: [
    {
      id: 'same-or-different',
      type: 'choice',
      prompt: 'Is everything the same, or can you see different parts?',
      choices: [
        { number: 1, label: 'Everything is the same.', value: 'same', correct: true },
        { number: 2, label: 'I can see different parts.', value: 'different', correct: false }
      ],
      correctAnswer: 'same'
    }
  ],
  finalAnswer: 'This is the same throughout.'
};

const DEMO_CONCEPT_TUTOR_PATTERNS = [
  DEMO_SAME_OR_DIFFERENT_PATTERN
];

function detectNewtonsLawsConceptTutorAudit(message) {
  const text = normalizeNewtonsLawsAuditText(message);
  const result = {
    shouldStartConceptTutor: false,
    law: '',
    triggerGroup: '',
    blockedReason: ''
  };

  if (!text) return { ...result, blockedReason: 'empty_prompt' };
  if (isPureNewtonsLawsDefinitionQuestion(text)) {
    return { ...result, blockedReason: 'pure_definition_or_explanation' };
  }
  if (isNewtonsLawsFormulaCalculationPrompt(text)) {
    return { ...result, blockedReason: 'formula_or_calculation_prompt' };
  }
  if (!asksForNewtonLawIdentification(text)) {
    return { ...result, blockedReason: 'not_law_identification' };
  }

  const clue = detectNewtonsLawsAuditClue(text);
  if (!clue) return { ...result, blockedReason: 'missing_newton_law_clue' };

  return {
    shouldStartConceptTutor: true,
    law: clue.law,
    triggerGroup: clue.triggerGroup,
    blockedReason: ''
  };
}

function buildNewtonsLawsConceptTutorPattern(message) {
  const audit = detectNewtonsLawsConceptTutorAudit(message);
  if (!audit.shouldStartConceptTutor) return null;

  const law = audit.law;
  const finalAnswer = getNewtonsLawsFinalAnswer(law);

  return {
    id: 'motion-force.newtons-laws.identification',
    topic: "Newton's laws identification",
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: audit.triggerGroup,
    steps: [
      {
        id: 'identify-newtons-law',
        type: 'choice',
        prompt: 'Which clue best matches the situation?',
        choices: [
          {
            number: 1,
            label: 'An object stays still or keeps moving until a force changes it.',
            value: 'first',
            correct: law === 'first',
            finalAnswer: getNewtonsLawsFinalAnswer('first')
          },
          {
            number: 2,
            label: 'Force, mass, and acceleration are connected.',
            value: 'second',
            correct: law === 'second',
            finalAnswer: getNewtonsLawsFinalAnswer('second')
          },
          {
            number: 3,
            label: 'Two objects push or pull on each other with opposite forces.',
            value: 'third',
            correct: law === 'third',
            finalAnswer: getNewtonsLawsFinalAnswer('third')
          }
        ],
        correctAnswer: law,
        hints: [
          'Look for whether the situation is about motion staying the same, force/mass/acceleration, or paired pushes and pulls.',
          getNewtonsLawsStrongerHint(law)
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function getNewtonsLawsFinalAnswer(law) {
  if (law === 'third') {
    return "This shows Newton's Third Law because two objects push or pull on each other with equal and opposite forces.";
  }
  if (law === 'second') {
    return "This shows Newton's Second Law because force, mass, and acceleration are connected.";
  }
  return "This shows Newton's First Law because the object stays at rest or keeps moving until a force changes it.";
}

function getNewtonsLawsStrongerHint(law) {
  if (law === 'third') return 'Choose the clue about two objects pushing or pulling on each other with opposite forces.';
  if (law === 'second') return 'Choose the clue that connects force, mass, and acceleration.';
  return 'Choose the clue about staying still, keeping motion, or inertia until a force changes it.';
}

function normalizeNewtonsLawsAuditText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\bf\s*=\s*m\s*[x*×]\s*a\b/g, 'force equals mass times acceleration')
    .replace(/\bf\s*=\s*ma\b/g, 'force equals mass times acceleration')
    .replace(/\b2nd\b/g, 'second')
    .replace(/\b1st\b/g, 'first')
    .replace(/\b3rd\b/g, 'third')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asksForNewtonLawIdentification(text) {
  return /\bwhich\s+(?:newtons?\s+)?law\b/.test(text) ||
    /\bwhat\s+(?:newtons?\s+)?law\b/.test(text) ||
    /\bnewtons?\s+law\s+is\b/.test(text) ||
    /\bwhich\s+law\s+(?:states|is|explains|shown)\b/.test(text);
}

function isPureNewtonsLawsDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|explain|describe)\s+(?:newtons?\s+)?(?:first|second|third)\s+law\b/.test(text)) return true;
  if (/^what\s+are\s+newtons?\s+laws?\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|explain|describe)\s+inertia\b/.test(text)) return true;
  return false;
}

function isNewtonsLawsFormulaCalculationPrompt(text) {
  const hasForceMassAccelerationTerms = /\bforce\b/.test(text) &&
    /\bmass\b/.test(text) &&
    /\bacceleration\b/.test(text);
  const asksToCalculate = /\b(?:calculate|find|solve|determine|what\s+force|what\s+is\s+the\s+force|what\s+is\s+the\s+acceleration|what\s+is\s+the\s+mass|how\s+much\s+force)\b/.test(text);
  const hasNumber = /\d/.test(text);
  const hasFormulaUnit = /\b(?:kg|kilograms?|n|newtons?|m\/s|m\/s2|m\/s\^2|m\/s²)\b/.test(text);
  const hasDirectionalNetForce = /\bforce\b/.test(text) && /\b(?:left|right|up|down|north|south|east|west)\b/.test(text);

  return (asksToCalculate && (hasForceMassAccelerationTerms || hasFormulaUnit || hasDirectionalNetForce)) ||
    (hasNumber && hasFormulaUnit && (hasForceMassAccelerationTerms || hasDirectionalNetForce));
}

function detectNewtonsLawsAuditClue(text) {
  if (/\b(?:action\s+and\s+reaction|action\s+reaction|equal\s+and\s+opposite|pushes?\s+back|pushing\s+water\s+backward|pushes?\s+water\s+backward|moves?\s+forward|rocket|swimmer|two\s+objects?\s+(?:pushing|pulling))\b/.test(text)) {
    return { law: 'third', triggerGroup: '3rd Law / action-reaction' };
  }
  if (/\b(?:stays?\s+(?:still|at\s+rest)|keeps?\s+moving|stays?\s+in\s+motion|unless\s+acted\s+on|inertia|seatbelt|sudden\s+stop|until\s+kicked|until\s+pushed)\b/.test(text)) {
    return { law: 'first', triggerGroup: '1st Law / inertia' };
  }
  if (/\b(?:force\s+equals\s+mass\s+times\s+acceleration|force\s+mass\s+acceleration|more\s+force|greater\s+force|harder\s+makes?\s+it\s+accelerate|shopping\s+cart|more\s+mass|less\s+acceleration)\b/.test(text)) {
    return { law: 'second', triggerGroup: '2nd Law / F = ma' };
  }
  return null;
}

function buildBalancedUnbalancedForcesConceptTutorPattern(message) {
  const text = normalizeBalancedUnbalancedForcesText(message);
  if (!shouldStartBalancedUnbalancedForcesTutor(text)) return null;

  const clue = detectBalancedUnbalancedForcesClue(text);
  if (!clue) return null;

  const finalAnswer = getBalancedUnbalancedForcesFinalAnswer(clue.classification);

  return {
    id: 'motion-force.balanced-unbalanced-forces.identification',
    topic: 'balanced and unbalanced forces',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: clue.triggerGroup,
    steps: [
      {
        id: 'identify-balanced-unbalanced-forces',
        type: 'choice',
        prompt: 'Are the forces balanced or unbalanced?',
        choices: [
          {
            number: 1,
            label: 'Balanced: forces are equal or cancel out.',
            value: 'balanced',
            correct: clue.classification === 'balanced',
            finalAnswer: getBalancedUnbalancedForcesFinalAnswer('balanced')
          },
          {
            number: 2,
            label: 'Unbalanced: forces are unequal and cause a change in motion.',
            value: 'unbalanced',
            correct: clue.classification === 'unbalanced',
            finalAnswer: getBalancedUnbalancedForcesFinalAnswer('unbalanced')
          }
        ],
        correctAnswer: clue.classification,
        hints: [
          'Balanced forces cancel out. Unbalanced forces leave a net force that can change motion.',
          clue.classification === 'balanced'
            ? 'Choose balanced when the forces are equal, cancel out, or motion does not change.'
            : 'Choose unbalanced when forces are unequal or the object speeds up, slows down, or changes direction.'
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartBalancedUnbalancedForcesTutor(text) {
  if (!text || isPureBalancedUnbalancedForcesDefinitionQuestion(text)) return false;
  if (isBalancedUnbalancedForcesFormulaCalculationPrompt(text)) return false;
  if (!asksForBalancedUnbalancedForcesIdentification(text)) return false;
  return Boolean(detectBalancedUnbalancedForcesClue(text));
}

function getBalancedUnbalancedForcesFinalAnswer(classification) {
  if (classification === 'unbalanced') {
    return "This shows unbalanced forces because the forces do not cancel out, so there is a net force and the object's motion can change.";
  }
  return 'This shows balanced forces because the forces are equal or cancel out, so the net force is zero and the motion does not change.';
}

function normalizeBalancedUnbalancedForcesText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\bf\s*=\s*m\s*[x*×]\s*a\b/g, 'force equals mass times acceleration')
    .replace(/\bf\s*=\s*ma\b/g, 'force equals mass times acceleration')
    .replace(/\bm\/s²\b/g, 'm/s2')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asksForBalancedUnbalancedForcesIdentification(text) {
  return /\b(?:balanced\s+or\s+unbalanced|unbalanced\s+or\s+balanced)\b/.test(text) ||
    /\b(?:is|are|would|will|could)\b.+\bforces?\b.+\b(?:balanced|unbalanced)\b/.test(text) ||
    /\b(?:is|are|would|will|could)\b.+\b(?:balanced|unbalanced)\b/.test(text);
}

function isPureBalancedUnbalancedForcesDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|what\s+are|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|an\s+|the\s+)?(?:balanced|unbalanced)\s+forces?\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|what\s+are|define|definition\s+of|explain|describe|summarize)\s+(?:balanced\s+and\s+unbalanced|balanced\s+or\s+unbalanced|balanced\s+vs\s+unbalanced|balanced\s+versus\s+unbalanced)\s+forces?\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe)\s+net\s+force\b/.test(text)) return true;
  if (/^what\s+does\s+balanced\s+mean\s+in\s+science\b/.test(text)) return true;
  if (/^\s*balanced\s+vs\s+unbalanced\s+forces?\s*$/.test(text)) return true;
  return false;
}

function isBalancedUnbalancedForcesFormulaCalculationPrompt(text) {
  const asksToCalculate = /\b(?:calculate|find|solve|determine|compute|what\s+is\s+the\s+net\s+force|what\s+is\s+net\s+force|what\s+is\s+the\s+acceleration|what\s+is\s+acceleration|what\s+force|how\s+much\s+force|what\s+mass|what\s+is\s+the\s+mass)\b/.test(text);
  const hasFormulaTerm = /\b(?:net\s+force|acceleration|mass|force\s+equals\s+mass\s+times\s+acceleration|f\s*net)\b/.test(text);
  const hasFormulaUnit = /\b(?:kg|kilograms?|n|newtons?|m\/s|m\/s2|m\/s\^2)\b/.test(text);

  return asksToCalculate || (hasFormulaTerm && hasFormulaUnit && /\d/.test(text));
}

function detectBalancedUnbalancedForcesClue(text) {
  if (/\b(?:unequal\s+forces?|one\s+team\s+pulls?\s+harder|pulls?\s+harder|pushed\s+harder|speeding\s+up|slowing\s+down|changes?\s+(?:motion|direction|speed)|cause\s+a\s+change\s+in\s+motion|net\s+force\s+(?:is\s+)?(?:not\s+zero|nonzero|non\s+zero))\b/.test(text)) {
    return { classification: 'unbalanced', triggerGroup: 'unequal forces / change in motion' };
  }

  if (/\b(?:equal\s+forces?|equal\s+pulls?|equal\s+and\s+opposite|opposite\s+sides?|cancel\s+out|net\s+force\s+(?:is\s+)?(?:zero|0)|sitting\s+still|stays?\s+still|at\s+rest|constant\s+speed|no\s+change\s+in\s+motion|motion\s+does\s+not\s+change)\b/.test(text)) {
    return { classification: 'balanced', triggerGroup: 'equal forces / no change in motion' };
  }

  const oppositeDirections = detectOppositeEqualForcePair(text);
  if (oppositeDirections) {
    return {
      classification: oppositeDirections === 'equal' ? 'balanced' : 'unbalanced',
      triggerGroup: oppositeDirections === 'equal' ? 'equal opposite numeric forces' : 'unequal opposite numeric forces'
    };
  }

  return null;
}

function detectOppositeEqualForcePair(text) {
  const directionalForces = [];
  const forcePattern = /(\d+(?:\.\d+)?)\s*(?:n|newtons?)\s+(?:pushes?\s+|pulls?\s+)?(left|right|up|down|north|south|east|west)\b/g;
  let match;
  while ((match = forcePattern.exec(text)) !== null) {
    directionalForces.push({
      value: Number(match[1]),
      direction: match[2]
    });
  }

  for (let index = 0; index < directionalForces.length; index += 1) {
    const first = directionalForces[index];
    const second = directionalForces.find((candidate, candidateIndex) => (
      candidateIndex !== index &&
      candidate.direction === getOppositeDirection(first.direction)
    ));
    if (second) return first.value === second.value ? 'equal' : 'unequal';
  }

  return '';
}

function getOppositeDirection(direction) {
  return {
    left: 'right',
    right: 'left',
    up: 'down',
    down: 'up',
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east'
  }[direction] || '';
}

function buildReferencePointConceptTutorPattern(message) {
  const text = normalizeReferencePointText(message);
  if (!shouldStartReferencePointTutor(text)) return null;

  const finalAnswer = 'A reference point is the place or object used for comparison when describing an object\'s position or motion.';

  return {
    id: 'motion-force.reference-point.identification',
    topic: 'reference point identification',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    steps: [
      {
        id: 'identify-reference-point',
        type: 'choice',
        prompt: "What do you compare an object's position or motion to?",
        choices: [
          {
            number: 1,
            label: 'A reference point',
            value: 'reference point',
            correct: true,
            finalAnswer
          },
          {
            number: 2,
            label: 'A force',
            value: 'force',
            correct: false
          },
          {
            number: 3,
            label: 'A mixture',
            value: 'mixture',
            correct: false
          }
        ],
        correctAnswer: 'reference point',
        hints: [
          'Position and motion are described by comparing them to a place or object.',
          'Choose the place or object used for comparison.'
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartReferencePointTutor(text) {
  if (!text || isPureReferencePointDefinitionQuestion(text)) return false;
  if (isReferencePointFormulaCalculationPrompt(text)) return false;
  return asksForReferencePointComparison(text);
}

function asksForReferencePointComparison(text) {
  if (!/\b(?:position|motion|changed position|change position)\b/.test(text)) return false;

  return /\bwhat\b.*\bcompare\b.*\b(?:position|motion)\b.*\bto\b/.test(text) ||
    /\bwhat\b.*\b(?:position|motion)\b.*\bcompare\b.*\bto\b/.test(text) ||
    /\bwhat\s+(?:point|place|object)\b.*\bcompare\b.*\bposition\b.*\bto\b/.test(text) ||
    /\bwhen\s+describing\s+motion\b.*\b(?:use|used)\b.*\bcomparison\b/.test(text) ||
    /\bwhat\s+is\s+used\s+to\s+tell\s+if\s+something\s+has\s+changed\s+position\b/.test(text) ||
    /\bwhich\s+choice\b.*\bused\b.*\bcompare\b.*\bobjects?\s+position\b/.test(text);
}

function isPureReferencePointDefinitionQuestion(text) {
  return /^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|an\s+|the\s+)?reference\s+point\b/.test(text) ||
    /^why\s+are\s+reference\s+points?\s+important\b/.test(text) ||
    /^(?:give|show|provide)\s+(?:me\s+)?(?:an?\s+)?example\s+of\s+(?:a\s+)?reference\s+point\b/.test(text);
}

function isReferencePointFormulaCalculationPrompt(text) {
  return /\b(?:calculate|find|solve|determine|compute)\b/.test(text) ||
    /\b(?:distance|time|speed|velocity|acceleration|force|mass)\b.*\d/.test(text) ||
    /\d.*\b(?:m\/s|m\/s2|m\/s\^2|m\/s²|meters?|metres?|seconds?|kg|kilograms?|n|newtons?)\b/.test(text);
}

function normalizeReferencePointText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDistanceDisplacementConceptTutorPattern(message) {
  const text = normalizeDistanceDisplacementText(message);
  if (!shouldStartDistanceDisplacementTutor(text)) return null;

  const classification = classifyDistanceDisplacementPrompt(text);
  if (!classification) return null;

  const finalAnswer = getDistanceDisplacementFinalAnswer(classification);

  return {
    id: 'motion-force.distance-displacement.identification',
    topic: 'distance and displacement',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification === 'displacement'
      ? 'straight-line change with direction'
      : 'total path traveled',
    steps: [
      {
        id: 'identify-distance-or-displacement',
        type: 'choice',
        prompt: 'Is it the total path traveled or the straight-line change from start to finish?',
        choices: [
          {
            number: 1,
            label: 'Total path traveled.',
            value: 'distance',
            correct: classification === 'distance',
            finalAnswer: getDistanceDisplacementFinalAnswer('distance')
          },
          {
            number: 2,
            label: 'Straight-line change from start to finish, with direction.',
            value: 'displacement',
            correct: classification === 'displacement',
            finalAnswer: getDistanceDisplacementFinalAnswer('displacement')
          }
        ],
        correctAnswer: classification,
        hints: [
          'Distance is the total path traveled. Displacement is the straight-line change from start to finish with direction.',
          classification === 'displacement'
            ? 'Choose straight-line change when the clue includes direction or where the object ended compared with where it started.'
            : 'Choose total path traveled when the clue is about the whole path or how much ground was covered.'
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartDistanceDisplacementTutor(text) {
  if (!text || isPureDistanceDisplacementDefinitionQuestion(text)) return false;
  if (isSpeedDistanceTimeFormulaCalculationPrompt(text)) return false;
  if (!asksForDistanceDisplacementIdentification(text)) return false;
  return Boolean(classifyDistanceDisplacementPrompt(text));
}

function asksForDistanceDisplacementIdentification(text) {
  return /\b(?:distance\s+or\s+displacement|displacement\s+or\s+distance)\b/.test(text) ||
    /\bwhich\s+is\s+(?:the\s+)?(?:distance|displacement)\b/.test(text);
}

function classifyDistanceDisplacementPrompt(text) {
  const whichTarget = text.match(/\bwhich\s+is\s+(?:the\s+)?(distance|displacement)\b/);
  if (whichTarget && hasDistanceDisplacementChoiceOptions(text)) {
    return whichTarget[1];
  }

  const description = extractSingleDistanceDisplacementDescription(text);
  if (!description) return '';
  if (hasDisplacementCue(description)) return 'displacement';
  if (hasDistanceCue(description)) return 'distance';
  return '';
}

function extractSingleDistanceDisplacementDescription(text) {
  const match = text.match(/^(?:is|are|would|will|could|can)\s+(.+?)\s+(?:an?\s+)?(?:distance\s+or\s+displacement|displacement\s+or\s+distance)\b/);
  return match ? match[1].trim() : '';
}

function hasDistanceDisplacementChoiceOptions(text) {
  if (!/\bor\b/.test(text)) return false;
  return hasDistanceCue(text) && hasDisplacementCue(text);
}

function hasDistanceCue(text) {
  return /\b(?:total\s+path|path\s+traveled|path\s+travelled|walked\s+total|traveled\s+total|travelled\s+total|total\s+distance|around\s+(?:a\s+)?(?:track|field|block)|around\s+the\s+(?:track|field|block)|whole\s+path|how\s+far\s+(?:it\s+|an?\s+object\s+)?(?:traveled|travelled|walked))\b/.test(text);
}

function hasDisplacementCue(text) {
  return /\b(?:straight\s*line\s+change|straight\s*line\s+distance|from\s+start\s+to\s+finish|from\s+the\s+start|from\s+where\s+(?:it|he|she|they|an?\s+object)\s+started|where\s+(?:it|he|she|they|an?\s+object)\s+started\s+with\s+direction|with\s+direction|includes?\s+direction|\d+(?:\.\d+)?\s*(?:m|meters?|metres?|km|kilometers?|kilometres?|mi|miles?|ft|feet)\s+(?:north|south|east|west|northeast|northwest|southeast|southwest|left|right|up|down))\b/.test(text);
}

function isPureDistanceDisplacementDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|an\s+|the\s+)?(?:distance|displacement)\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+distance\s+and\s+displacement\b/.test(text)) return true;
  if (/^how\s+are\s+distance\s+and\s+displacement\s+different\b/.test(text)) return true;
  if (/^(?:compare|contrast)\s+distance\s+and\s+displacement\b/.test(text)) return true;
  if (/^distance\s+(?:vs\.?|versus)\s+displacement$/.test(text)) return true;
  return false;
}

function getDistanceDisplacementFinalAnswer(classification) {
  if (classification === 'displacement') {
    return 'This describes displacement because it is the straight-line change from start to finish and includes direction.';
  }
  return 'This describes distance because it is the total path traveled, no matter what direction the object moved.';
}

function normalizeDistanceDisplacementText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSpeedVelocityConceptTutorPattern(message) {
  const text = normalizeSpeedVelocityText(message);
  if (!shouldStartSpeedVelocityTutor(text)) return null;

  const classification = classifySpeedVelocityPrompt(text);
  if (!classification) return null;

  const finalAnswer = getSpeedVelocityFinalAnswer(classification);

  return {
    id: 'motion-force.speed-velocity.identification',
    topic: 'speed and velocity',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification === 'velocity' ? 'speed with direction' : 'speed without direction',
    steps: [
      {
        id: 'identify-speed-or-velocity',
        type: 'choice',
        prompt: 'Does the description include direction?',
        choices: [
          {
            number: 1,
            label: 'No, it only tells how fast something moves.',
            value: 'speed',
            correct: classification === 'speed',
            finalAnswer: getSpeedVelocityFinalAnswer('speed')
          },
          {
            number: 2,
            label: 'Yes, it tells speed and direction.',
            value: 'velocity',
            correct: classification === 'velocity',
            finalAnswer: getSpeedVelocityFinalAnswer('velocity')
          }
        ],
        correctAnswer: classification,
        hints: [
          'Speed only tells how fast something moves. Velocity tells speed and direction.',
          classification === 'velocity'
            ? 'Choose yes when the description includes a direction like north, east, west, or to the left.'
            : 'Choose no when the description gives only how fast something moves.'
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartSpeedVelocityTutor(text) {
  if (!text || isPureSpeedVelocityDefinitionQuestion(text)) return false;
  if (isSpeedDistanceTimeFormulaCalculationPrompt(text)) return false;
  if (!asksForSpeedVelocityIdentification(text)) return false;
  return Boolean(classifySpeedVelocityPrompt(text));
}

function asksForSpeedVelocityIdentification(text) {
  return /\b(?:speed\s+or\s+velocity|velocity\s+or\s+speed)\b/.test(text) ||
    /\bwhich\s+is\s+(?:the\s+)?(?:speed|velocity)\b/.test(text);
}

function classifySpeedVelocityPrompt(text) {
  const whichTarget = text.match(/\bwhich\s+is\s+(?:the\s+)?(speed|velocity)\b/);
  if (whichTarget && hasSpeedVelocityChoiceOptions(text)) {
    return whichTarget[1];
  }

  const description = extractSingleSpeedVelocityDescription(text);
  if (!description || !hasSpeedMagnitude(description)) return '';
  return hasDirectionCue(description) ? 'velocity' : 'speed';
}

function extractSingleSpeedVelocityDescription(text) {
  const match = text.match(/^(?:is|are|would|will|could|can)\s+(.+?)\s+(?:an?\s+)?(?:speed\s+or\s+velocity|velocity\s+or\s+speed)\b/);
  return match ? match[1].trim() : '';
}

function hasSpeedVelocityChoiceOptions(text) {
  if (!/\bor\b/.test(text) || !hasSpeedMagnitude(text)) return false;
  return hasDirectionCue(text);
}

function hasSpeedMagnitude(text) {
  return /\b\d+(?:\.\d+)?\s*(?:m\/s|meters?\s+per\s+second|metres?\s+per\s+second|km\/h|km\/hr|kilometers?\s+per\s+hour|kilometres?\s+per\s+hour|mph|mi\/hr|miles?\s+per\s+hour)\b/.test(text);
}

function hasDirectionCue(text) {
  return /\b(?:north|south|east|west|northeast|northwest|southeast|southwest|left|right|up|down|forward|backward|toward|towards|away|clockwise|counterclockwise)\b/.test(text);
}

function isPureSpeedVelocityDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|an\s+|the\s+)?(?:speed|velocity)\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+speed\s+and\s+velocity\b/.test(text)) return true;
  if (/^how\s+are\s+speed\s+and\s+velocity\s+different\b/.test(text)) return true;
  if (/^(?:compare|contrast)\s+speed\s+and\s+velocity\b/.test(text)) return true;
  if (/^speed\s+(?:vs\.?|versus)\s+velocity$/.test(text)) return true;
  return false;
}

function isSpeedDistanceTimeFormulaCalculationPrompt(text) {
  const asksToCalculate = /\b(?:calculate|find|solve|determine|compute)\b/.test(text) ||
    /\bwhat\s+is\s+(?:the\s+)?(?:speed|distance|time|velocity)\b/.test(text);
  const hasSpeedDistanceTimeTerm = /\b(?:speed|distance|time|velocity|travels?|travelled|traveled)\b/.test(text);
  const hasFormulaUnit = /\b(?:m\/s|meters?|metres?|seconds?|secs?|s\b|km\/h|km\/hr|mph|mi\/hr|miles?|kilometers?|kilometres?)\b/.test(text);

  return asksToCalculate && hasSpeedDistanceTimeTerm && hasFormulaUnit && /\d/.test(text);
}

function getSpeedVelocityFinalAnswer(classification) {
  if (classification === 'velocity') {
    return 'This describes velocity because it tells how fast something moves and includes direction.';
  }
  return 'This describes speed because it tells how fast something moves without giving a direction.';
}

function normalizeSpeedVelocityText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAccelerationConceptTutorPattern(message) {
  const text = normalizeAccelerationText(message);
  if (!shouldStartAccelerationTutor(text)) return null;

  const clue = detectAccelerationClue(text);
  if (!clue) return null;

  const finalAnswer = getAccelerationFinalAnswer();

  return {
    id: 'motion-force.acceleration.identification',
    topic: 'acceleration identification',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: clue.triggerGroup,
    steps: [
      {
        id: 'identify-acceleration-change',
        type: 'choice',
        prompt: 'What kind of change in motion is happening?',
        choices: [
          {
            number: 1,
            label: 'Speeding up',
            value: 'speeding up',
            correct: true,
            finalAnswer
          },
          {
            number: 2,
            label: 'Slowing down',
            value: 'slowing down',
            correct: true,
            finalAnswer
          },
          {
            number: 3,
            label: 'Changing direction',
            value: 'changing direction',
            correct: true,
            finalAnswer
          }
        ],
        correctAnswer: clue.change,
        hints: [
          'Acceleration means a change in velocity. Velocity changes when speed changes or direction changes.',
          `Choose the clue that matches this prompt: ${clue.change}.`
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartAccelerationTutor(text) {
  if (!text || isPureAccelerationDefinitionQuestion(text)) return false;
  if (isAccelerationFormulaCalculationPrompt(text)) return false;
  if (!asksForAccelerationIdentification(text)) return false;
  return Boolean(detectAccelerationClue(text));
}

function asksForAccelerationIdentification(text) {
  return /\b(?:is|are|would|will|could|can)\b.+\bacceleration\b/.test(text) ||
    /\bwhich\s+is\s+(?:an?\s+)?acceleration\b/.test(text) ||
    /\bwhich\s+(?:one|choice|example)\b.+\bacceleration\b/.test(text);
}

function detectAccelerationClue(text) {
  if (/\b(?:speeding\s+up|speeds?\s+up|speed\s+increases?|increasing\s+speed|moving\s+faster|gets?\s+faster)\b/.test(text)) {
    return { change: 'speeding up', triggerGroup: 'speeding up' };
  }
  if (/\b(?:slowing\s+down|slows?\s+down|speed\s+decreases?|decreasing\s+speed|moving\s+slower|gets?\s+slower|decelerating|deceleration)\b/.test(text)) {
    return { change: 'slowing down', triggerGroup: 'slowing down' };
  }
  if (/\b(?:changing\s+direction|changes?\s+direction|turning\s+(?:a\s+)?corner|turns?\s+(?:a\s+)?corner|turning|turns?|curving|curve|around\s+a\s+turn|wide\s+turn)\b/.test(text)) {
    return { change: 'changing direction', triggerGroup: 'changing direction' };
  }
  return null;
}

function isPureAccelerationDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|an\s+|the\s+)?acceleration\b/.test(text)) return true;
  if (/^what\s+does\s+acceleration\s+mean\b/.test(text)) return true;
  if (/^how\s+is\s+acceleration\s+different\s+from\s+speed\b/.test(text)) return true;
  if (/^(?:compare|contrast)\s+acceleration\s+and\s+speed\b/.test(text)) return true;
  return false;
}

function isAccelerationFormulaCalculationPrompt(text) {
  const asksToCalculate = /\b(?:calculate|find|solve|determine|compute)\b/.test(text) ||
    /\bwhat\s+is\s+(?:the\s+)?acceleration\b/.test(text) ||
    /\bwhat\s+acceleration\b/.test(text);
  const hasNumber = /\d/.test(text);
  const hasFormulaUnit = /\b(?:kg|kilograms?|n|newtons?|m\/s|m\/s2|m\/s\^2|m\/s²|seconds?|secs?|s\b)\b/.test(text);
  const hasFormulaCue = /\b(?:force|mass|final\s+velocity|initial\s+velocity|velocity\s+changes?|velocity\s+change|from\s+\d|to\s+\d|time)\b/.test(text);

  return (asksToCalculate && (hasNumber || hasFormulaUnit || hasFormulaCue)) ||
    (hasNumber && hasFormulaUnit && /\bacceleration\b/.test(text));
}

function getAccelerationFinalAnswer() {
  return 'This describes acceleration because acceleration means a change in velocity. An object accelerates when it speeds up, slows down, or changes direction.';
}

function normalizeAccelerationText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\bf\s*=\s*m\s*[x*×]\s*a\b/g, 'force equals mass times acceleration')
    .replace(/\bf\s*=\s*ma\b/g, 'force equals mass times acceleration')
    .replace(/\bm\/s²\b/g, 'm/s2')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTransverseLongitudinalWavesConceptTutorPattern(message) {
  const text = normalizeTransverseLongitudinalWavesText(message);
  if (!shouldStartTransverseLongitudinalWavesTutor(text)) return null;

  const classification = classifyTransverseLongitudinalWavePrompt(text);
  if (!classification) return null;

  const finalAnswer = getTransverseLongitudinalFinalAnswer(classification);

  return {
    id: 'waves.transverse-longitudinal.identification',
    topic: 'transverse and longitudinal waves',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification === 'transverse' ? 'perpendicular wave motion' : 'parallel wave motion',
    steps: [
      {
        id: 'identify-transverse-or-longitudinal-wave',
        type: 'choice',
        prompt: 'How does the matter in the wave move compared with the direction the wave travels?',
        choices: [
          {
            number: 1,
            label: 'Up and down or side to side, perpendicular to the wave direction.',
            value: 'transverse',
            correct: classification === 'transverse',
            finalAnswer: getTransverseLongitudinalFinalAnswer('transverse')
          },
          {
            number: 2,
            label: 'Back and forth, parallel to the wave direction.',
            value: 'longitudinal',
            correct: classification === 'longitudinal',
            finalAnswer: getTransverseLongitudinalFinalAnswer('longitudinal')
          }
        ],
        correctAnswer: classification,
        hints: [
          'Transverse waves move matter perpendicular to the wave direction. Longitudinal waves move matter parallel to the wave direction.',
          classification === 'transverse'
            ? 'Choose the clue about up-and-down, side-to-side, or perpendicular motion.'
            : 'Choose the clue about back-and-forth or parallel motion.'
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartTransverseLongitudinalWavesTutor(text) {
  if (!text || isPureTransverseLongitudinalWavesDefinitionQuestion(text)) return false;
  if (isWaveFormulaCalculationPrompt(text)) return false;
  if (!asksForTransverseLongitudinalIdentification(text)) return false;
  return Boolean(classifyTransverseLongitudinalWavePrompt(text));
}

function asksForTransverseLongitudinalIdentification(text) {
  return /\b(?:transverse\s+or\s+longitudinal|longitudinal\s+or\s+transverse)\b/.test(text) ||
    /\bwhich\s+is\s+(?:a\s+)?(?:transverse|longitudinal)\b/.test(text);
}

function classifyTransverseLongitudinalWavePrompt(text) {
  const whichTarget = text.match(/\bwhich\s+is\s+(?:a\s+)?(transverse|longitudinal)\b/);
  if (whichTarget && hasTransverseLongitudinalChoiceOptions(text)) {
    return whichTarget[1];
  }

  if (hasLongitudinalWaveClue(text)) return 'longitudinal';
  if (hasTransverseWaveClue(text)) return 'transverse';
  return '';
}

function hasTransverseLongitudinalChoiceOptions(text) {
  return /\bor\b/.test(text) &&
    (hasTransverseWaveClue(text) || hasLongitudinalWaveClue(text));
}

function hasTransverseWaveClue(text) {
  return /\b(?:up\s+and\s+down|up\s+down|side\s+to\s+side|perpendicular|right\s+angles?|rope\s+wave|wave\s+on\s+a\s+rope|waves?\s+on\s+(?:a\s+)?rope)\b/.test(text);
}

function hasLongitudinalWaveClue(text) {
  return /\b(?:back\s+and\s+forth|parallel|same\s+direction|sound\s+wave|sound\s+waves?)\b/.test(text);
}

function isPureTransverseLongitudinalWavesDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|an\s+|the\s+)?(?:transverse|longitudinal)\s+wave\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+transverse\s+and\s+longitudinal\s+waves?\b/.test(text)) return true;
  if (/^how\s+are\s+transverse\s+and\s+longitudinal\s+waves?\s+different\b/.test(text)) return true;
  if (/^(?:compare|contrast)\s+transverse\s+and\s+longitudinal\s+waves?\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|the\s+)?wave\b/.test(text)) return true;
  return false;
}

function isWaveFormulaCalculationPrompt(text) {
  const asksToCalculate = /\b(?:calculate|find|solve|determine|compute)\b/.test(text) ||
    /\bwhat\s+is\s+(?:the\s+)?(?:wave\s+)?(?:speed|velocity|frequency|wavelength|period)\b/.test(text);
  const hasWaveFormulaTerm = /\b(?:wave|waves|speed|velocity|frequency|wavelength|period|lambda)\b/.test(text);
  const hasFormulaUnit = /\b(?:m\/s|meters?|metres?|seconds?|secs?|s\b|hz|hertz)\b/.test(text);

  return asksToCalculate && hasWaveFormulaTerm && (hasFormulaUnit || /\d/.test(text));
}

function getTransverseLongitudinalFinalAnswer(classification) {
  if (classification === 'longitudinal') {
    return 'This describes a longitudinal wave because the matter moves back and forth parallel to the direction the wave travels.';
  }
  return 'This describes a transverse wave because the matter moves perpendicular to the direction the wave travels.';
}

function normalizeTransverseLongitudinalWavesText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMechanicalElectromagneticWavesConceptTutorPattern(message) {
  const text = normalizeMechanicalElectromagneticWavesText(message);
  if (!shouldStartMechanicalElectromagneticWavesTutor(text)) return null;

  const classification = classifyMechanicalElectromagneticWavePrompt(text);
  if (!classification) return null;

  const finalAnswer = getMechanicalElectromagneticFinalAnswer(classification);

  return {
    id: 'waves.mechanical-electromagnetic.identification',
    topic: 'mechanical and electromagnetic waves',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification === 'mechanical' ? 'needs a medium' : 'travels through empty space',
    steps: [
      {
        id: 'identify-mechanical-or-electromagnetic-wave',
        type: 'choice',
        prompt: 'Does this wave need matter as a medium, or can it travel through empty space?',
        choices: [
          {
            number: 1,
            label: 'Needs matter or a medium.',
            value: 'mechanical',
            correct: classification === 'mechanical',
            finalAnswer: getMechanicalElectromagneticFinalAnswer('mechanical')
          },
          {
            number: 2,
            label: 'Can travel through empty space.',
            value: 'electromagnetic',
            correct: classification === 'electromagnetic',
            finalAnswer: getMechanicalElectromagneticFinalAnswer('electromagnetic')
          }
        ],
        correctAnswer: classification,
        hints: [
          'Mechanical waves need matter as a medium. Electromagnetic waves can travel through empty space.',
          classification === 'mechanical'
            ? 'Choose the clue about needing matter or a medium.'
            : 'Choose the clue about traveling through empty space.'
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartMechanicalElectromagneticWavesTutor(text) {
  if (!text || isWaveFormulaCalculationPrompt(text)) return false;
  if (hasMixedWaveClassificationSystems(text)) return false;
  if (isBroadWaveTypeQuestion(text)) return false;
  if (hasTransverseLongitudinalPair(text)) return false;
  if (!asksForMechanicalElectromagneticIdentification(text)) return false;
  return Boolean(classifyMechanicalElectromagneticWavePrompt(text));
}

function asksForMechanicalElectromagneticIdentification(text) {
  return /\b(?:mechanical\s+or\s+electromagnetic|electromagnetic\s+or\s+mechanical)\b/.test(text) ||
    /\bwhich\s+(?:type\s+of\s+)?wave\s+(?:needs|requires)\s+(?:a\s+)?(?:medium|matter)\b/.test(text) ||
    /\bwhich\s+(?:type\s+of\s+)?wave\s+can\s+travel\s+through\s+(?:empty\s+space|a\s+vacuum|vacuum|space)\b/.test(text) ||
    /\bwhich\s+is\s+(?:a\s+)?(?:mechanical|electromagnetic)\b/.test(text);
}

function classifyMechanicalElectromagneticWavePrompt(text) {
  const whichTarget = text.match(/\bwhich\s+is\s+(?:a\s+)?(mechanical|electromagnetic)\b/);
  if (whichTarget && hasMechanicalElectromagneticChoiceOptions(text)) {
    return whichTarget[1];
  }

  if (/\b(?:needs|requires)\s+(?:a\s+)?(?:medium|matter)\b/.test(text)) return 'mechanical';
  if (/\b(?:travel|travels|transfer|moves?)\s+through\s+(?:empty\s+space|a\s+vacuum|vacuum|space)\b/.test(text)) return 'electromagnetic';

  if (hasMechanicalWaveClue(text)) return 'mechanical';
  if (hasElectromagneticWaveClue(text)) return 'electromagnetic';
  return '';
}

function hasMechanicalElectromagneticChoiceOptions(text) {
  return /\bor\b/.test(text) &&
    (hasMechanicalWaveClue(text) || hasElectromagneticWaveClue(text));
}

function hasMechanicalWaveClue(text) {
  return /\b(?:sound|ocean\s+wave|ocean\s+waves|water\s+wave|water\s+waves|seismic\s+wave|seismic\s+waves|wave\s+on\s+a\s+rope|rope\s+wave|rope\s+waves)\b/.test(text);
}

function hasElectromagneticWaveClue(text) {
  return /\b(?:light|radio\s+wave|radio\s+waves|microwave|microwaves|infrared|ultraviolet|uv|x\s*-?\s*rays?|gamma\s+rays?)\b/.test(text);
}

function hasMixedWaveClassificationSystems(text) {
  return /\b(?:longitudinal|transverse)\s+or\s+(?:mechanical|electromagnetic)\b/.test(text) ||
    /\b(?:mechanical|electromagnetic)\s+or\s+(?:longitudinal|transverse)\b/.test(text);
}

function hasTransverseLongitudinalPair(text) {
  return /\b(?:transverse\s+or\s+longitudinal|longitudinal\s+or\s+transverse)\b/.test(text);
}

function isBroadWaveTypeQuestion(text) {
  if (/\bwhat\s+(?:type|kind)\s+of\s+wave\b/.test(text)) return true;
  if (/\bis\s+(?:light|sound)\s+a\s+mechanical\s+or\s+electromagnetic\s+wave\b/.test(text)) return true;
  return /\bis\s+(?:a\s+)?water\s+wave\s+mechanical\s+or\s+electromagnetic\b/.test(text);
}

function getMechanicalElectromagneticFinalAnswer(classification) {
  if (classification === 'electromagnetic') {
    return 'This describes an electromagnetic wave because it can travel through empty space and does not need a medium.';
  }
  return 'This describes a mechanical wave because it needs matter or a medium to travel.';
}

function normalizeMechanicalElectromagneticWavesText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildReflectionRefractionAbsorptionConceptTutorPattern(message) {
  const text = normalizeReflectionRefractionAbsorptionText(message);
  if (!shouldStartReflectionRefractionAbsorptionTutor(text)) return null;

  const classification = classifyReflectionRefractionAbsorptionPrompt(text);
  if (!classification) return null;

  const finalAnswer = getReflectionRefractionAbsorptionFinalAnswer(classification);

  return {
    id: 'waves.reflection-refraction-absorption.identification',
    topic: 'reflection, refraction, and absorption',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification,
    steps: [
      {
        id: 'identify-reflection-refraction-or-absorption',
        type: 'choice',
        prompt: 'What happens to the wave or light?',
        choices: [
          {
            number: 1,
            label: 'It bounces off a surface.',
            value: 'reflection',
            correct: classification === 'reflection',
            finalAnswer: getReflectionRefractionAbsorptionFinalAnswer('reflection')
          },
          {
            number: 2,
            label: 'It bends as it enters a new material.',
            value: 'refraction',
            correct: classification === 'refraction',
            finalAnswer: getReflectionRefractionAbsorptionFinalAnswer('refraction')
          },
          {
            number: 3,
            label: 'It is taken in by the material.',
            value: 'absorption',
            correct: classification === 'absorption',
            finalAnswer: getReflectionRefractionAbsorptionFinalAnswer('absorption')
          }
        ],
        correctAnswer: classification,
        hints: [
          'Reflection bounces off, refraction bends in a new material, and absorption is taken in.',
          getReflectionRefractionAbsorptionHint(classification)
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartReflectionRefractionAbsorptionTutor(text) {
  if (!text || isPureReflectionRefractionAbsorptionDefinitionQuestion(text)) return false;
  if (isWaveFormulaCalculationPrompt(text) || isEnergyTransferFormulaCalculationPrompt(text)) return false;
  if (isUnit5WaveClassificationPrompt(text)) return false;
  if (!asksForReflectionRefractionAbsorptionIdentification(text)) return false;
  return Boolean(classifyReflectionRefractionAbsorptionPrompt(text));
}

function asksForReflectionRefractionAbsorptionIdentification(text) {
  return hasReflectionRefractionAbsorptionChoice(text) ||
    /\bwhich\s+(?:one\s+)?is\s+(?:an?\s+)?(?:reflection|refraction|absorption)\b/.test(text);
}

function classifyReflectionRefractionAbsorptionPrompt(text) {
  const whichTarget = text.match(/\bwhich\s+(?:one\s+)?is\s+(?:an?\s+)?(reflection|refraction|absorption)\b/);
  if (whichTarget && hasReflectionRefractionAbsorptionChoiceOptions(text)) {
    return whichTarget[1];
  }

  if (hasRefractionClue(text)) return 'refraction';
  if (hasAbsorptionClue(text)) return 'absorption';
  if (hasReflectionClue(text)) return 'reflection';
  return '';
}

function hasReflectionRefractionAbsorptionChoice(text) {
  return /\breflection\s*,?\s+refraction\s*,?\s+or\s+absorption\b/.test(text) ||
    /\breflection\s+refraction\s+or\s+absorption\b/.test(text) ||
    /\breflecton\s+refraction\s+or\s+absorption\b/.test(text) ||
    /\breflection\b/.test(text) && /\brefraction\b/.test(text) && /\babsorption\b/.test(text);
}

function hasReflectionRefractionAbsorptionChoiceOptions(text) {
  return /\bor\b/.test(text) &&
    (hasReflectionClue(text) || hasRefractionClue(text) || hasAbsorptionClue(text));
}

function hasReflectionClue(text) {
  return /\b(?:bounce|bounces|bouncing|bounced|bouncing\s+off|bounces?\s+off|mirror|echo|reflects?|reflected)\b/.test(text);
}

function hasRefractionClue(text) {
  return /\b(?:bend|bends|bending|bent|straw\s+(?:looking\s+)?bent|bent\s+straw|looks?\s+bent\s+in\s+water|water|glass|lens|new\s+material|through\s+glass|enter(?:s|ing)?\s+a\s+new\s+material)\b/.test(text);
}

function hasAbsorptionClue(text) {
  return /\b(?:taken\s+in|takes?\s+in|soaking\s+up|absorbed|absorbs?|black\s+shirt|black\s+pavement|black\s+paper|dark\s+(?:material|surface|hoodie)|black\s+shirt\s+getting\s+warm|getting\s+(?:warm|hot)\s+in\s+sunlight|getting\s+hot|warming\s+from\s+light|shirt\s+warming|paper\s+warming|light\s+energy\s+taken\s+in)\b/.test(text);
}

function isPureReflectionRefractionAbsorptionDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|an\s+|the\s+)?(?:reflection|refraction|absorption)\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+reflection\s*,?\s+refraction\s*,?\s+and\s+absorption\b/.test(text)) return true;
  if (/^how\s+are\s+reflection\s*,?\s+refraction\s*,?\s+and\s+absorption\s+different\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|the\s+)?wave\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+light\b/.test(text)) return true;
  return false;
}

function getReflectionRefractionAbsorptionFinalAnswer(classification) {
  if (classification === 'refraction') {
    return 'This describes refraction because the wave or light bends when it enters a new material.';
  }
  if (classification === 'absorption') {
    return 'This describes absorption because the material takes in the wave or light energy.';
  }
  return 'This describes reflection because the wave or light bounces off a surface.';
}

function getReflectionRefractionAbsorptionHint(classification) {
  if (classification === 'refraction') return 'Choose the clue about bending in water, glass, a lens, or another new material.';
  if (classification === 'absorption') return 'Choose the clue about the material taking in light or getting warmer.';
  return 'Choose the clue about bouncing off, like a mirror or an echo.';
}

function normalizeReflectionRefractionAbsorptionText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildWavePropertiesConceptTutorPattern(message) {
  const text = normalizeWavePropertiesText(message);
  if (!shouldStartWavePropertiesTutor(text)) return null;

  const classification = classifyWavePropertiesPrompt(text);
  if (!classification) return null;

  const finalAnswer = getWavePropertiesFinalAnswer(classification);

  return {
    id: 'waves.properties.amplitude-wavelength-frequency',
    topic: 'amplitude, wavelength, and frequency',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification,
    steps: [
      {
        id: 'identify-wave-property',
        type: 'choice',
        prompt: 'Which wave property is being described?',
        choices: [
          {
            number: 1,
            label: 'Amplitude: height of the wave.',
            value: 'amplitude',
            correct: classification === 'amplitude',
            finalAnswer: getWavePropertiesFinalAnswer('amplitude')
          },
          {
            number: 2,
            label: 'Wavelength: distance from crest to crest or trough to trough.',
            value: 'wavelength',
            correct: classification === 'wavelength',
            finalAnswer: getWavePropertiesFinalAnswer('wavelength')
          },
          {
            number: 3,
            label: 'Frequency: number of waves passing per second.',
            value: 'frequency',
            correct: classification === 'frequency',
            finalAnswer: getWavePropertiesFinalAnswer('frequency')
          }
        ],
        correctAnswer: classification,
        hints: [
          'Amplitude is height, wavelength is crest-to-crest or trough-to-trough distance, and frequency is waves each second.',
          getWavePropertiesHint(classification)
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartWavePropertiesTutor(text) {
  if (!text || isPureWavePropertiesDefinitionQuestion(text)) return false;
  if (isWaveFormulaCalculationPrompt(text)) return false;
  if (isUnit5WaveClassificationPrompt(text)) return false;
  if (!asksForWavePropertiesIdentification(text)) return false;
  return Boolean(classifyWavePropertiesPrompt(text));
}

function asksForWavePropertiesIdentification(text) {
  return hasAmplitudeWavelengthFrequencyChoice(text) ||
    /\bwhich\s+(?:one\s+)?is\s+(?:an?\s+)?(?:amplitude|wavelength|frequency)\b/.test(text);
}

function classifyWavePropertiesPrompt(text) {
  const whichTarget = text.match(/\bwhich\s+(?:one\s+)?is\s+(?:an?\s+)?(amplitude|wavelength|frequency)\b/);
  if (whichTarget && hasWavePropertiesChoiceOptions(text)) {
    return whichTarget[1];
  }

  if (hasFrequencyPropertyClue(text)) return 'frequency';
  if (hasWavelengthPropertyClue(text)) return 'wavelength';
  if (hasAmplitudePropertyClue(text)) return 'amplitude';
  return '';
}

function hasAmplitudeWavelengthFrequencyChoice(text) {
  return /\bamplitude\s*,?\s+wavelength\s*,?\s+or\s+frequency\b/.test(text) ||
    /\bamplitude\s+wavelength\s+or\s+frequency\b/.test(text) ||
    /\bamplitude\b/.test(text) && /\bwavelength\b/.test(text) && /\bfrequency\b/.test(text);
}

function hasWavePropertiesChoiceOptions(text) {
  return /\bor\b/.test(text) &&
    (hasAmplitudePropertyClue(text) || hasWavelengthPropertyClue(text) || hasFrequencyPropertyClue(text));
}

function hasAmplitudePropertyClue(text) {
  return /\b(?:height\s+of\s+(?:a\s+)?wave|wave\s+height|height|hieght|tallness|tall\s+wave)\b/.test(text);
}

function hasWavelengthPropertyClue(text) {
  return /\b(?:crest\s*-?\s*to\s*-?\s*crest|trough\s*-?\s*to\s*-?\s*trough|trouf\s+to\s+trouf|crest\s+to\s+crest|trough\s+to\s+trough|distance\s+from\s+crest\s+to\s+crest|distance\s+from\s+trough\s+to\s+trough|distance\s+between\s+waves?|space\s+between\s+one\s+wave\s+and\s+the\s+next|crest\s+to\s+crest\s+gap|trough\s+to\s+trough\s+distance)\b/.test(text);
}

function hasFrequencyPropertyClue(text) {
  return /\b(?:number\s+of\s+waves?\s+(?:passing\s+)?per\s+second|waves?\s+per\s+second|waves?\s+(?:each|every)\s+second|cycles?\s+per\s+(?:second|sec)|hertz|hz)\b/.test(text);
}

function isPureWavePropertiesDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:an?\s+|the\s+)?(?:amplitude|wavelength|frequency)\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+amplitude\s*,?\s+wavelength\s*,?\s+and\s+frequency\b/.test(text)) return true;
  if (/^how\s+are\s+amplitude\s*,?\s+wavelength\s*,?\s+and\s+frequency\s+different\b/.test(text)) return true;
  return false;
}

function getWavePropertiesFinalAnswer(classification) {
  if (classification === 'wavelength') {
    return 'This describes wavelength because wavelength is the distance from one crest to the next crest, or one trough to the next trough.';
  }
  if (classification === 'frequency') {
    return 'This describes frequency because frequency is the number of waves that pass a point each second.';
  }
  return 'This describes amplitude because amplitude is the height of a wave.';
}

function getWavePropertiesHint(classification) {
  if (classification === 'wavelength') return 'Choose the clue about distance from crest to crest, trough to trough, or between waves.';
  if (classification === 'frequency') return 'Choose the clue about waves or cycles each second, measured in hertz.';
  return 'Choose the clue about wave height.';
}

function normalizeWavePropertiesText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\bwave\s+length\b/g, 'wavelength')
    .replace(/\bfrequincy\b/g, 'frequency')
    .replace(/\bfrequncy\b/g, 'frequency')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildOpenClosedCircuitsConceptTutorPattern(message) {
  const text = normalizeOpenClosedCircuitsText(message);
  if (!shouldStartOpenClosedCircuitsTutor(text)) return null;

  const classification = classifyOpenClosedCircuitPrompt(text);
  if (!classification) return null;

  const finalAnswer = getOpenClosedCircuitFinalAnswer(classification);

  return {
    id: 'electricity.circuits.open-closed.identification',
    topic: 'open and closed circuits',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification,
    steps: [
      {
        id: 'identify-open-or-closed-circuit',
        type: 'choice',
        prompt: 'Can electric current flow?',
        choices: [
          {
            number: 1,
            label: 'Yes, the path is complete.',
            value: 'closed circuit',
            correct: classification === 'closed',
            finalAnswer: getOpenClosedCircuitFinalAnswer('closed')
          },
          {
            number: 2,
            label: 'No, the path is broken or open.',
            value: 'open circuit',
            correct: classification === 'open',
            finalAnswer: getOpenClosedCircuitFinalAnswer('open')
          }
        ],
        correctAnswer: classification,
        hints: [
          'A closed circuit has a complete path, so current can flow. An open circuit has a broken path, so current cannot flow.',
          classification === 'closed'
            ? 'Choose the clue about a complete path, closed switch, current flowing, or a bulb lighting.'
            : 'Choose the clue about a broken path, open switch, current stopping, or a bulb being off.'
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartOpenClosedCircuitsTutor(text) {
  if (!text || isPureOpenClosedCircuitDefinitionQuestion(text)) return false;
  if (isElectricityFormulaCalculationPrompt(text)) return false;
  if (!asksForOpenClosedCircuitIdentification(text)) return false;
  return Boolean(classifyOpenClosedCircuitPrompt(text));
}

function asksForOpenClosedCircuitIdentification(text) {
  return hasOpenClosedCircuitChoice(text) ||
    /\bwhich\s+(?:one\s+)?is\s+(?:an?\s+)?(?:open|closed)\b/.test(text);
}

function classifyOpenClosedCircuitPrompt(text) {
  const whichTarget = text.match(/\bwhich\s+(?:one\s+)?is\s+(?:an?\s+)?(open|closed)\b/);
  if (whichTarget && hasOpenClosedCircuitChoiceOptions(text)) {
    return whichTarget[1];
  }

  if (hasOpenCircuitClue(text)) return 'open';
  if (hasClosedCircuitClue(text)) return 'closed';
  return '';
}

function hasOpenClosedCircuitChoice(text) {
  return /\bopen\s+or\s+closed(?:\s+circuit)?\b/.test(text) ||
    /\bclosed\s+or\s+open(?:\s+circuit)?\b/.test(text) ||
    /\bopen\b/.test(text) && /\bclosed\b/.test(text) && /\bcircuit\b/.test(text);
}

function hasOpenClosedCircuitChoiceOptions(text) {
  return /\bor\b/.test(text) &&
    (hasOpenCircuitClue(text) || hasClosedCircuitClue(text));
}

function hasClosedCircuitClue(text) {
  return /\b(?:complete\s+path|path\s+is\s+complete|closed\s+switch|switch\s+is\s+shut|bulb\s+lights?|bulb\s+glows?|lamp\s+is\s+lit|lamp\s+lit|light\s+bulb\s+lights?|current\s+flows?|current\s+is\s+flowing|current\s+can\s+(?:flow|go)|lets?\s+current\s+flow|complete\s+circuit|connected\s+path|full\s+loop|all\s+connected|path\s+isnt\s+broken|path\s+is\s+not\s+broken)\b/.test(text);
}

function hasOpenCircuitClue(text) {
  return /\b(?:broken\s+path|path\s+is\s+broken|broken\s+wire|wire\s+is\s+cut|one\s+wire\s+is\s+cut|open\s+switch|switch\s+is\s+open|switch\s+is\s+up|bulb\s+is\s+off|bulb\s+off|light\s+bulb\s+is\s+off|current\s+cannot\s+(?:flow|go)|current\s+cant\s+(?:flow|go)|current\s+does\s+not\s+flow|current\s+stops?|gap|incomplete\s+path|break\s+in\s+the\s+path)\b/.test(text);
}

function isPureOpenClosedCircuitDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:an?\s+|the\s+)?(?:open|closed)\s+circuit\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+open\s+and\s+closed\s+circuits?\b/.test(text)) return true;
  if (/^how\s+are\s+open\s+and\s+closed\s+circuits?\s+different\b/.test(text)) return true;
  if (/^why\s+does\s+(?:a\s+)?(?:bulb|light\s+bulb)\s+turn\s+off\s+in\s+an?\s+open\s+circuit\b/.test(text)) return true;
  return false;
}

function isElectricityFormulaCalculationPrompt(text) {
  if (!/\b(?:calculate|find|solve|determine|compute)\b/.test(text)) return false;
  return /\b(?:voltage|current|resistance|ohms?|amps?|amperes?|volts?|watts?|power|circuit|v\b|i\b|r\b|p\b)\b/.test(text) ||
    /\d/.test(text);
}

function getOpenClosedCircuitFinalAnswer(classification) {
  if (classification === 'open') {
    return 'This describes an open circuit because the path is broken or open, so current cannot flow.';
  }
  return 'This describes a closed circuit because the path is complete, so current can flow.';
}

function normalizeOpenClosedCircuitsText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\bcircut\b/g, 'circuit')
    .replace(/\bswich\b/g, 'switch')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSeriesParallelCircuitsConceptTutorPattern(message) {
  const text = normalizeSeriesParallelCircuitsText(message);
  if (!shouldStartSeriesParallelCircuitsTutor(text)) return null;

  const classification = classifySeriesParallelCircuitPrompt(text);
  if (!classification) return null;

  const finalAnswer = getSeriesParallelCircuitFinalAnswer(classification);

  return {
    id: 'electricity.circuits.series-parallel.identification',
    topic: 'series and parallel circuits',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification,
    steps: [
      {
        id: 'identify-series-or-parallel-circuit',
        type: 'choice',
        prompt: 'How are the parts connected?',
        choices: [
          {
            number: 1,
            label: 'Series: one path for current.',
            value: 'series circuit',
            correct: classification === 'series',
            finalAnswer: getSeriesParallelCircuitFinalAnswer('series')
          },
          {
            number: 2,
            label: 'Parallel: more than one path for current.',
            value: 'parallel circuit',
            correct: classification === 'parallel',
            finalAnswer: getSeriesParallelCircuitFinalAnswer('parallel')
          }
        ],
        correctAnswer: classification,
        hints: [
          'Series circuits have one path. Parallel circuits have more than one path or branches.',
          classification === 'series'
            ? 'Choose the clue about one path, same current, or one bulb making all bulbs go out.'
            : 'Choose the clue about branches, many paths, or other bulbs staying on.'
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartSeriesParallelCircuitsTutor(text) {
  if (!text || isPureSeriesParallelCircuitDefinitionQuestion(text)) return false;
  if (isElectricityFormulaCalculationPrompt(text)) return false;
  if (hasOpenClosedCircuitChoice(text)) return false;
  if (!asksForSeriesParallelCircuitIdentification(text)) return false;
  return Boolean(classifySeriesParallelCircuitPrompt(text));
}

function asksForSeriesParallelCircuitIdentification(text) {
  return hasSeriesParallelCircuitChoice(text) ||
    /\bwhich\s+is\s+(?:a\s+)?(?:series|parallel)\b/.test(text);
}

function classifySeriesParallelCircuitPrompt(text) {
  const whichTarget = text.match(/\bwhich\s+is\s+(?:a\s+)?(series|parallel)\b/);
  if (whichTarget && hasSeriesParallelCircuitChoiceOptions(text)) {
    return whichTarget[1];
  }

  if (hasParallelCircuitClue(text)) return 'parallel';
  if (hasSeriesCircuitClue(text)) return 'series';
  return '';
}

function hasSeriesParallelCircuitChoice(text) {
  return /\bseries\s+or\s+parallel\b/.test(text) ||
    /\bparallel\s+or\s+series\b/.test(text) ||
    /\bseries\b/.test(text) && /\bparallel\b/.test(text) && /\bcircuit\b/.test(text);
}

function hasSeriesParallelCircuitChoiceOptions(text) {
  return /\bor\b/.test(text) &&
    (hasSeriesCircuitClue(text) || hasParallelCircuitClue(text));
}

function hasSeriesCircuitClue(text) {
  return /\b(?:one\s+path|single\s+path|one\s+single\s+path|only\s+one\s+path|one\s+road\s+for\s+current|same\s+current\s+through\s+(?:all|each\s+part)|same\s+current|one\s+(?:lite\s+)?bulb\s+(?:goes\s+)?out\s+and\s+(?:every|all)\s+bulbs?\s+(?:(?:go(?:es)?)\s+)?(?:out|dies?)|all\s+bulbs\s+(?:go\s+)?out|all\s+lights?\s+(?:go\s+)?out)\b/.test(text);
}

function hasParallelCircuitClue(text) {
  return /\b(?:more\s+than\s+one\s+path|more\s+then\s+one\s+path|multiple\s+paths?|many\s+(?:branch\s+)?paths?|branches?|branch|current\s+can\s+split|split\s+into\s+(?:two\s+)?branches?|one\s+bulb\s+(?:goes\s+)?out\s+and\s+(?:the\s+)?others\s+stay\s+on|one\s+bulb\s+burns\s+out\s+but\s+(?:the\s+)?other\s+lights?\s+stay\s+on|others\s+stay\s+on|other\s+bulbs\s+stay\s+on|other\s+lights?\s+stay\s+on)\b/.test(text);
}

function isPureSeriesParallelCircuitDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|the\s+)?(?:series|parallel)\s+circuit\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+series\s+and\s+parallel\s+circuits?\b/.test(text)) return true;
  if (/^how\s+are\s+series\s+and\s+parallel\s+circuits?\s+different\b/.test(text)) return true;
  return false;
}

function getSeriesParallelCircuitFinalAnswer(classification) {
  if (classification === 'parallel') {
    return 'This describes a parallel circuit because current has more than one path to follow.';
  }
  return 'This describes a series circuit because current has only one path to follow.';
}

function normalizeSeriesParallelCircuitsText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\bcircut\b/g, 'circuit')
    .replace(/\bparalell\b/g, 'parallel')
    .replace(/\bparalel\b/g, 'parallel')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildEndothermicExothermicConceptTutorPattern(message) {
  const text = normalizeEndothermicExothermicText(message);
  if (!shouldStartEndothermicExothermicTutor(text)) return null;

  const classification = classifyEndothermicExothermicPrompt(text);
  if (!classification) return null;

  const finalAnswer = getEndothermicExothermicFinalAnswer(classification);

  return {
    id: 'energy.processes.endothermic-exothermic.identification',
    topic: 'endothermic and exothermic processes',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification,
    steps: [
      {
        id: 'identify-endothermic-or-exothermic',
        type: 'choice',
        prompt: 'What happens to thermal energy?',
        choices: [
          {
            number: 1,
            label: 'Energy is absorbed from the surroundings.',
            value: 'endothermic',
            correct: classification === 'endothermic',
            finalAnswer: getEndothermicExothermicFinalAnswer('endothermic')
          },
          {
            number: 2,
            label: 'Energy is released to the surroundings.',
            value: 'exothermic',
            correct: classification === 'exothermic',
            finalAnswer: getEndothermicExothermicFinalAnswer('exothermic')
          }
        ],
        correctAnswer: classification,
        hints: [
          'Endothermic absorbs energy from surroundings. Exothermic releases energy to surroundings.',
          classification === 'endothermic'
            ? 'Choose the clue about melting, evaporation, cold packs, or energy being absorbed.'
            : 'Choose the clue about burning, freezing, hand warmers, or energy being released.'
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartEndothermicExothermicTutor(text) {
  if (!text || isPureEndothermicExothermicDefinitionQuestion(text)) return false;
  if (isEnergyProcessFormulaCalculationPrompt(text)) return false;
  if (hasPhysicalChemicalChangePair(text)) return false;
  if (hasConductionConvectionRadiationChoice(text)) return false;
  if (!asksForEndothermicExothermicIdentification(text)) return false;
  return Boolean(classifyEndothermicExothermicPrompt(text));
}

function asksForEndothermicExothermicIdentification(text) {
  return hasEndothermicExothermicChoice(text) ||
    /\bwhich\s+(?:one\s+)?is\s+(?:an?\s+)?(?:endothermic|exothermic)\b/.test(text) ||
    /\b(?:absorbs?|releases?)\s+(?:thermal\s+)?(?:energy|heat)\b/.test(text) ||
    /\b(?:energy|heat)\s+(?:is\s+)?(?:absorbed|released)\b/.test(text) ||
    /\btakes?\s+in\s+(?:thermal\s+)?(?:energy|heat)\b/.test(text);
}

function classifyEndothermicExothermicPrompt(text) {
  const whichTarget = text.match(/\bwhich\s+(?:one\s+)?is\s+(?:an?\s+)?(endothermic|exothermic)\b/);
  if (whichTarget && hasEndothermicExothermicChoiceOptions(text)) {
    return whichTarget[1];
  }

  if (hasEndothermicClue(text)) return 'endothermic';
  if (hasExothermicClue(text)) return 'exothermic';
  return '';
}

function hasEndothermicExothermicChoice(text) {
  return /\bendothermic\s+or\s+exothermic\b/.test(text) ||
    /\bexothermic\s+or\s+endothermic\b/.test(text) ||
    /\bendo\s+or\s+exothermic\b/.test(text) ||
    /\bendothermic\b/.test(text) && /\bexothermic\b/.test(text);
}

function hasEndothermicExothermicChoiceOptions(text) {
  return /\bor\b/.test(text) &&
    (hasEndothermicClue(text) || hasExothermicClue(text));
}

function hasEndothermicClue(text) {
  return /\b(?:melting|melts?|melting\s+(?:ice|snow)|ice\s+melting|evaporation|evaporating|evaporates?|boiling\s+water\s+into\s+vapor|instant\s+cold\s+pack|instant\s+cold\s+pak|cold\s+pack|cold\s+pak|takes?\s+in\s+(?:thermal\s+)?(?:energy|heat)|absorbs?\s+(?:thermal\s+)?(?:energy|heat)|(?:energy|heat)\s+(?:is\s+)?absorbed|absorbed\s+from\s+(?:the\s+)?surroundings)\b/.test(text);
}

function hasExothermicClue(text) {
  return /\b(?:burning|burns?|fire|fire\s+burning|freezing|freezes?|freezing\s+water|water\s+freezing|hand\s+warmer|hand\s+warmer\s+packs?|gives?\s+off\s+heat|lets?\s+heat\s+out|releases?\s+(?:thermal\s+)?(?:energy|heat)|(?:energy|heat)\s+(?:is\s+)?released|released\s+to\s+(?:the\s+)?surroundings)\b/.test(text);
}

function isPureEndothermicExothermicDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:an?\s+|the\s+)?(?:endothermic|exothermic)\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+endothermic\s+and\s+exothermic\b/.test(text)) return true;
  if (/^how\s+are\s+endothermic\s+and\s+exothermic\s+different\b/.test(text)) return true;
  if (/^(?:give|list|show)\s+examples?\s+of\s+endothermic\s+and\s+exothermic\s+processes?\b/.test(text)) return true;
  return false;
}

function isEnergyProcessFormulaCalculationPrompt(text) {
  if (!/\b(?:calculate|find|solve|determine|compute)\b/.test(text)) return false;
  return /\b(?:kinetic\s+energy|thermal\s+energy|heat|specific\s+heat|temperature|work|power|force|distance|mass|velocity|time|joules?|j\b|watts?|w\b|degrees?|celsius)\b/.test(text) ||
    /\d/.test(text);
}

function getEndothermicExothermicFinalAnswer(classification) {
  if (classification === 'exothermic') {
    return 'This describes an exothermic process because energy is released to the surroundings.';
  }
  return 'This describes an endothermic process because energy is absorbed from the surroundings.';
}

function normalizeEndothermicExothermicText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\breleese\b/g, 'release')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMechanicalEnergyTypesConceptTutorPattern(message) {
  const text = normalizeMechanicalEnergyTypesText(message);
  if (!shouldStartMechanicalEnergyTypesTutor(text)) return null;

  const classification = classifyMechanicalEnergyTypesPrompt(text);
  if (!classification) return null;

  const finalAnswer = getMechanicalEnergyTypesFinalAnswer(classification);

  return {
    id: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
    topic: 'mechanical energy types',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification,
    steps: [
      {
        id: 'identify-mechanical-energy-type',
        type: 'choice',
        prompt: 'What kind of mechanical energy is being described?',
        choices: [
          {
            number: 1,
            label: 'Kinetic energy: energy of motion.',
            value: 'kinetic',
            correct: classification === 'kinetic',
            finalAnswer: getMechanicalEnergyTypesFinalAnswer('kinetic')
          },
          {
            number: 2,
            label: 'Gravitational potential energy: stored energy because of height or position.',
            value: 'gravitational_potential',
            correct: classification === 'gravitational_potential',
            finalAnswer: getMechanicalEnergyTypesFinalAnswer('gravitational_potential')
          },
          {
            number: 3,
            label: 'Elastic potential energy: stored energy in something stretched or compressed.',
            value: 'elastic_potential',
            correct: classification === 'elastic_potential',
            finalAnswer: getMechanicalEnergyTypesFinalAnswer('elastic_potential')
          }
        ],
        correctAnswer: classification,
        hints: [
          'Kinetic means moving. Gravitational potential means stored because of height or position. Elastic potential means stored in something stretched or compressed.',
          getMechanicalEnergyTypesHint(classification)
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartMechanicalEnergyTypesTutor(text) {
  if (!text || isPureMechanicalEnergyTypesDefinitionQuestion(text)) return false;
  if (isMechanicalEnergyTypesFormulaCalculationPrompt(text)) return false;
  if (hasEndothermicExothermicChoice(text)) return false;
  if (hasConductionConvectionRadiationChoice(text)) return false;
  if (!asksForMechanicalEnergyTypesIdentification(text)) return false;
  return Boolean(classifyMechanicalEnergyTypesPrompt(text));
}

function asksForMechanicalEnergyTypesIdentification(text) {
  return hasMechanicalEnergyTypesChoice(text) ||
    /\bwhich\s+(?:one\s+)?is\s+(?:an?\s+)?(?:kinetic|gravitational\s+potential|elastic\s+potential)\b/.test(text);
}

function classifyMechanicalEnergyTypesPrompt(text) {
  const whichTarget = text.match(/\bwhich\s+(?:one\s+)?is\s+(?:an?\s+)?(kinetic|gravitational\s+potential|elastic\s+potential)\b/);
  if (whichTarget && hasMechanicalEnergyTypesChoiceOptions(text)) {
    if (whichTarget[1] === 'gravitational potential') return 'gravitational_potential';
    if (whichTarget[1] === 'elastic potential') return 'elastic_potential';
    return 'kinetic';
  }

  if (hasElasticPotentialEnergyClue(text)) return 'elastic_potential';
  if (hasGravitationalPotentialEnergyClue(text)) return 'gravitational_potential';
  if (hasKineticEnergyClue(text)) return 'kinetic';
  return '';
}

function hasMechanicalEnergyTypesChoice(text) {
  return /\bkinetic\s*,?\s+gravitational\s+potential\s*,?\s+or\s+elastic\s+potential\s+energy\b/.test(text) ||
    /\bkinetic\s+gravitational\s+potential\s+or\s+elastic\s+potential\s+energy\b/.test(text) ||
    /\bkinetic\b/.test(text) &&
      /\bgravitational\s+potential\b/.test(text) &&
      /\belastic\s+potential\b/.test(text);
}

function hasMechanicalEnergyTypesChoiceOptions(text) {
  return /\bor\b/.test(text) &&
    (hasKineticEnergyClue(text) || hasGravitationalPotentialEnergyClue(text) || hasElasticPotentialEnergyClue(text));
}

function hasKineticEnergyClue(text) {
  return /\b(?:moving\s+car|rolling\s+ball|rolling|moving|motion|energy\s+of\s+motion|mechanical\s+kinetic\s+energy|skateboard\s+rolling|moving\s+soccer\s+ball|moving\s+cart|moving\s+bike)\b/.test(text);
}

function hasGravitationalPotentialEnergyClue(text) {
  return /\b(?:book\s+on\s+a\s+shelf|book\s+high\s+up|ball\s+held\s+(?:(?:way\s+)?above\s+(?:the\s+)?(?:ground|floor))|above\s+(?:the\s+)?(?:ground|floor)|height|high\s+on\s+a\s+cliff|rock\s+(?:sitting\s+)?high\s+on\s+a\s+cliff|rock\s+on\s+a\s+hill|up\s+on\s+a\s+tall\s+shelf|position\s+above\s+ground|stored\s+energy\s+(?:because|due)\s+of\s+height|stored\s+energy\s+(?:because|due)\s+of\s+position)\b/.test(text);
}

function hasElasticPotentialEnergyClue(text) {
  return /\b(?:stretched\s+rubber\s+band|pulled\s+back\s+rubber\s+band|compressed\s+spring|squished\s+spring|stretched|compressed|spring|rubber\s+band|stored\s+energy\s+in\s+something\s+stretched|stored\s+energy\s+in\s+something\s+compressed)\b/.test(text);
}

function isPureMechanicalEnergyTypesDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:an?\s+|the\s+)?(?:kinetic\s+energy|gravitational\s+potential\s+energy|elastic\s+potential\s+energy|mechanical\s+energy)\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+kinetic\s*,?\s+gravitational\s+potential\s*,?\s+and\s+elastic\s+potential\s+energy\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+kinetic\s+energy\s+and\s+potential\s+energy\b/.test(text)) return true;
  if (/^how\s+are\s+kinetic\s*,?\s+gravitational\s+potential\s*,?\s+and\s+elastic\s+potential\s+energy\s+different\b/.test(text)) return true;
  if (/^(?:what\s+are|list|name|explain)\s+(?:the\s+)?(?:different\s+)?types?\s+of\s+energy\b/.test(text)) return true;
  if (/\bchemical\b/.test(text) && /\bthermal\b/.test(text) && /\belectrical\b/.test(text)) return true;
  if (/\b(?:is\s+kinetic\s+energy\s+mechanical\s+energy|is\s+mechanical\s+kinetic\s+energy\s+a\s+real\s+thing)\b/.test(text)) return true;
  return false;
}

function isMechanicalEnergyTypesFormulaCalculationPrompt(text) {
  if (!/\b(?:calculate|find|solve|determine|compute)\b/.test(text)) return false;
  return /\b(?:kinetic\s+energy|potential\s+energy|gravitational\s+potential\s+energy|elastic\s+potential\s+energy|work|power|mass|velocity|height|gravity|spring\s+constant|stretch|force|distance|time|kg|kilograms?|m\/s|joules?|j\b|newtons?|n\/m|watts?|w\b)\b/.test(text) ||
    /\d/.test(text);
}

function getMechanicalEnergyTypesFinalAnswer(classification) {
  if (classification === 'gravitational_potential') {
    return 'This describes gravitational potential energy because it is stored energy due to height or position.';
  }
  if (classification === 'elastic_potential') {
    return 'This describes elastic potential energy because it is stored energy in something stretched or compressed.';
  }
  return 'This describes kinetic energy because kinetic energy is the energy of motion.';
}

function getMechanicalEnergyTypesHint(classification) {
  if (classification === 'gravitational_potential') return 'Choose the clue about height, position, or being above the ground.';
  if (classification === 'elastic_potential') return 'Choose the clue about stretching or compressing a spring, rubber band, or similar object.';
  return 'Choose the clue about motion, moving, or rolling.';
}

function normalizeMechanicalEnergyTypesText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\bgravitional\b/g, 'gravitational')
    .replace(/\bpotental\b/g, 'potential')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildEnergyTransferConceptTutorPattern(message) {
  const text = normalizeEnergyTransferText(message);
  if (!shouldStartEnergyTransferTutor(text)) return null;

  const classification = classifyEnergyTransferPrompt(text);
  if (!classification) return null;

  const finalAnswer = getEnergyTransferFinalAnswer(classification);

  return {
    id: 'energy.transfer.conduction-convection-radiation',
    topic: 'conduction, convection, and radiation',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification,
    steps: [
      {
        id: 'identify-energy-transfer',
        type: 'choice',
        prompt: 'How is thermal energy being transferred?',
        choices: [
          {
            number: 1,
            label: 'By direct contact or touching.',
            value: 'conduction',
            correct: classification === 'conduction',
            finalAnswer: getEnergyTransferFinalAnswer('conduction')
          },
          {
            number: 2,
            label: 'By movement or circulation of a liquid or gas.',
            value: 'convection',
            correct: classification === 'convection',
            finalAnswer: getEnergyTransferFinalAnswer('convection')
          },
          {
            number: 3,
            label: 'By waves through space, with no direct contact needed.',
            value: 'radiation',
            correct: classification === 'radiation',
            finalAnswer: getEnergyTransferFinalAnswer('radiation')
          }
        ],
        correctAnswer: classification,
        hints: [
          'Conduction is touching, convection is moving liquid or gas, and radiation is waves with no contact needed.',
          getEnergyTransferHint(classification)
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartEnergyTransferTutor(text) {
  if (!text || isPureEnergyTransferDefinitionQuestion(text)) return false;
  if (isEnergyTransferFormulaCalculationPrompt(text)) return false;
  if (isUnit5WaveClassificationPrompt(text)) return false;
  if (!asksForEnergyTransferIdentification(text)) return false;
  return Boolean(classifyEnergyTransferPrompt(text));
}

function asksForEnergyTransferIdentification(text) {
  return hasConductionConvectionRadiationChoice(text) ||
    /\bwhich\s+is\s+(?:an?\s+)?(?:conduction|convection|radiation)\b/.test(text) ||
    /\bwhich\s+heat\s+transfer\b/.test(text) ||
    /\bwhat\s+heat\s+transfer\b/.test(text);
}

function classifyEnergyTransferPrompt(text) {
  const whichTarget = text.match(/\bwhich\s+is\s+(?:an?\s+)?(conduction|convection|radiation)\b/);
  if (whichTarget && hasEnergyTransferChoiceOptions(text)) {
    return whichTarget[1];
  }

  if (hasConvectionClue(text)) return 'convection';
  if (hasRadiationHeatTransferClue(text)) return 'radiation';
  if (hasConductionClue(text)) return 'conduction';
  return '';
}

function hasConductionConvectionRadiationChoice(text) {
  return /\bconduction\s*,?\s+convection\s*,?\s+or\s+radiation\b/.test(text) ||
    /\bconduction\s+convection\s+or\s+radiation\b/.test(text) ||
    /\bconduction\b/.test(text) && /\bconvection\b/.test(text) && /\bradiation\b/.test(text);
}

function hasEnergyTransferChoiceOptions(text) {
  return /\bor\b/.test(text) &&
    (hasConductionClue(text) || hasConvectionClue(text) || hasRadiationHeatTransferClue(text));
}

function hasConductionClue(text) {
  return /\b(?:direct\s+contact|touching|touches?|touched|metal\s+spoon|spoon|hot\s+pan|pan|ice\s+melting\s+in\s+(?:your\s+)?hand|melting\s+in\s+(?:your\s+)?hand|heated\s+by\s+a\s+stove|heated\s+by\s+the\s+stove)\b/.test(text);
}

function hasConvectionClue(text) {
  return /\b(?:warm\s+air\s+rising|hot\s+air\s+rising|air\s+rising|boiling\s+water\s+circulating|water\s+circulating|circulat(?:e|es|ing|ion)|convection\s+current|liquid\s+or\s+gas\s+movement|movement\s+of\s+(?:a\s+)?liquid\s+or\s+gas|liquids?\s+or\s+gases?\s+move)\b/.test(text);
}

function hasRadiationHeatTransferClue(text) {
  return /\b(?:heat\s+from\s+the\s+sun|sunlight|sun\s+to|from\s+the\s+sun|fire\s+without\s+touching|without\s+touching|no\s+direct\s+contact|no\s+contact|heat\s+from\s+a\s+fire|heat\s+from\s+a\s+lamp|lamp\s+heat|light\s+warming|waves?\s+through\s+space|through\s+space)\b/.test(text);
}

function isPureEnergyTransferDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|an\s+|the\s+)?(?:conduction|convection|radiation)\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+conduction\s*,?\s+convection\s*,?\s+and\s+radiation\b/.test(text)) return true;
  if (/^how\s+are\s+conduction\s*,?\s+convection\s*,?\s+and\s+radiation\s+different\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:thermal\s+energy|heat\s+transfer)\b/.test(text)) return true;
  if (/^(?:give|list|show)\s+examples?\s+of\s+conduction\s*,?\s+convection\s*,?\s+and\s+radiation\b/.test(text)) return true;
  return false;
}

function isEnergyTransferFormulaCalculationPrompt(text) {
  if (!/\b(?:calculate|find|solve|determine|compute)\b/.test(text)) return false;
  return /\b(?:kinetic\s+energy|potential\s+energy|work|power|thermal\s+energy|heat\s+energy|wave\s+speed|wavelength|frequency|velocity|mass|force|distance|height|time)\b/.test(text) ||
    /\d/.test(text);
}

function isUnit5WaveClassificationPrompt(text) {
  if (/\b(?:mechanical\s+or\s+electromagnetic|electromagnetic\s+or\s+mechanical|transverse\s+or\s+longitudinal|longitudinal\s+or\s+transverse)\b/.test(text)) return true;
  if (/\bwhat\s+(?:type|kind)\s+of\s+wave\b/.test(text)) return true;
  return /\b(?:electromagnetic\s+wave|transverse\s+wave|longitudinal\s+wave|radio\s+wave|microwave|sound\s+wave|wave\s+on\s+a\s+rope)\b/.test(text) &&
    !hasConductionConvectionRadiationChoice(text);
}

function getEnergyTransferFinalAnswer(classification) {
  if (classification === 'convection') {
    return 'This describes convection because thermal energy is transferred by movement or circulation of a liquid or gas.';
  }
  if (classification === 'radiation') {
    return 'This describes radiation because thermal energy is transferred by waves through space without direct contact.';
  }
  return 'This describes conduction because thermal energy is transferred by direct contact or touching.';
}

function getEnergyTransferHint(classification) {
  if (classification === 'convection') return 'Choose the clue about heated liquid or gas moving or circulating.';
  if (classification === 'radiation') return 'Choose the clue about waves, sunlight, space, or feeling heat without touching.';
  return 'Choose the clue about touching or direct contact.';
}

function normalizeEnergyTransferText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAcidsBasesConceptTutorPattern(message) {
  const text = normalizeAcidsBasesText(message);
  if (!shouldStartAcidsBasesTutor(text)) return null;

  const classification = classifyAcidsBasesPrompt(text);
  if (!classification) return null;

  const finalAnswer = getAcidsBasesFinalAnswer(classification);

  return {
    id: 'chemistry.acids-bases.identification',
    topic: 'acidic, basic, and neutral substances',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification,
    steps: [
      {
        id: 'identify-acidic-basic-neutral',
        type: 'choice',
        prompt: 'What does the pH or example tell you?',
        choices: [
          {
            number: 1,
            label: 'Acidic: pH below 7.',
            value: 'acidic',
            correct: classification === 'acidic',
            finalAnswer: getAcidsBasesFinalAnswer('acidic')
          },
          {
            number: 2,
            label: 'Neutral: pH equal to 7.',
            value: 'neutral',
            correct: classification === 'neutral',
            finalAnswer: getAcidsBasesFinalAnswer('neutral')
          },
          {
            number: 3,
            label: 'Basic: pH above 7.',
            value: 'basic',
            correct: classification === 'basic',
            finalAnswer: getAcidsBasesFinalAnswer('basic')
          }
        ],
        correctAnswer: classification,
        hints: [
          'pH below 7 is acidic, pH 7 is neutral, and pH above 7 is basic.',
          getAcidsBasesHint(classification)
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartAcidsBasesTutor(text) {
  if (!text || isPureAcidsBasesDefinitionQuestion(text)) return false;
  if (isAcidsBasesFormulaCalculationPrompt(text)) return false;
  if (isBroadAcidsBasesExplanationPrompt(text)) return false;
  if (!asksForAcidicBasicNeutralIdentification(text)) return false;
  return Boolean(classifyAcidsBasesPrompt(text));
}

function asksForAcidicBasicNeutralIdentification(text) {
  return hasAcidicBasicNeutralChoice(text) ||
    /\bwhich\s+is\s+(?:an?\s+)?(?:acidic|neutral|basic)\b/.test(text);
}

function classifyAcidsBasesPrompt(text) {
  const whichTarget = text.match(/\bwhich\s+is\s+(?:an?\s+)?(acidic|neutral|basic)\b/);
  if (whichTarget && hasAcidsBasesChoiceOptions(text)) {
    return whichTarget[1];
  }

  const phValue = extractPhValue(text);
  if (phValue !== null) return classifyPhValue(phValue);

  if (hasAcidicExample(text)) return 'acidic';
  if (hasNeutralExample(text)) return 'neutral';
  if (hasBasicExample(text)) return 'basic';
  return '';
}

function hasAcidicBasicNeutralChoice(text) {
  return /\bacidic\b/.test(text) && /\bbasic\b/.test(text) && /\bneutral\b/.test(text);
}

function hasAcidsBasesChoiceOptions(text) {
  return /\bor\b/.test(text) &&
    (/\bph\s*\d+(?:\.\d+)?\b/.test(text) || hasAcidicExample(text) || hasNeutralExample(text) || hasBasicExample(text));
}

function extractPhValue(text) {
  const match = text.match(/\bph\s*(?:is\s*)?(\d+(?:\.\d+)?)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function classifyPhValue(value) {
  if (value < 7) return 'acidic';
  if (value === 7) return 'neutral';
  return 'basic';
}

function hasAcidicExample(text) {
  return /\b(?:vinegar|lemon\s+juice|stomach\s+acid)\b/.test(text);
}

function hasNeutralExample(text) {
  return /\b(?:pure\s+water|distilled\s+water)\b/.test(text);
}

function hasBasicExample(text) {
  return /\b(?:soap|baking\s+soda|bleach|ammonia)\b/.test(text);
}

function isPureAcidsBasesDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:an?\s+|the\s+)?acid\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|the\s+)?base\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+ph\b/.test(text)) return true;
  if (/^what\s+does\s+ph\s+measure\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|the\s+)?neutral\s+substance\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+acids?\s+and\s+bases?\b/.test(text)) return true;
  if (/^how\s+are\s+acids?\s+and\s+bases?\s+different\b/.test(text)) return true;
  if (/^(?:give|list|show)\s+examples?\s+of\s+acids?\s+and\s+bases?\b/.test(text)) return true;
  if (/\bacetic\s+acid\b/.test(text)) return true;
  return false;
}

function isBroadAcidsBasesExplanationPrompt(text) {
  return /^why\s+/.test(text) ||
    /^how\s+can\s+you\s+tell\b/.test(text) ||
    /\bwhat\s+happens\b.*\bacid\b.*\bbase\b.*\breact\b/.test(text) ||
    /^(?:what\s+is|whats|define|explain)\s+neutralization\b/.test(text);
}

function isAcidsBasesFormulaCalculationPrompt(text) {
  if (/\bph\b/.test(text) && /\b(?:hydrogen\s+ion|h\+|concentration|given|calculate|find|solve|determine)\b/.test(text)) return true;
  return /\b(?:calculate|find|solve|determine|compute)\b/.test(text);
}

function getAcidsBasesFinalAnswer(classification) {
  if (classification === 'neutral') {
    return 'This describes a neutral substance because neutral substances have a pH of 7.';
  }
  if (classification === 'basic') {
    return 'This describes a basic substance because bases have a pH above 7.';
  }
  return 'This describes an acidic substance because acids have a pH below 7.';
}

function getAcidsBasesHint(classification) {
  if (classification === 'neutral') return 'Choose neutral when the pH is exactly 7.';
  if (classification === 'basic') return 'Choose basic when the pH is above 7.';
  return 'Choose acidic when the pH is below 7.';
}

function normalizeAcidsBasesText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPhysicalChemicalChangeConceptTutorPattern(message) {
  const text = normalizePhysicalChemicalChangeText(message);
  if (!shouldStartPhysicalChemicalChangeTutor(text)) return null;

  const classification = classifyPhysicalChemicalChangePrompt(text);
  if (!classification) return null;

  const finalAnswer = getPhysicalChemicalChangeFinalAnswer(classification);

  return {
    id: 'matter.physical-chemical-change.identification',
    topic: 'physical and chemical changes',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification,
    steps: [
      {
        id: 'identify-physical-or-chemical-change',
        type: 'choice',
        prompt: 'Does the change make a new substance?',
        choices: [
          {
            number: 1,
            label: 'No, it only changes form, size, shape, or state.',
            value: 'physical change',
            correct: classification === 'physical',
            finalAnswer: getPhysicalChemicalChangeFinalAnswer('physical')
          },
          {
            number: 2,
            label: 'Yes, it makes a new substance.',
            value: 'chemical change',
            correct: classification === 'chemical',
            finalAnswer: getPhysicalChemicalChangeFinalAnswer('chemical')
          }
        ],
        correctAnswer: classification,
        hints: [
          'Physical changes keep the same substance. Chemical changes form a new substance.',
          classification === 'chemical'
            ? 'Choose yes when burning, rusting, baking, fizzing, or another reaction makes something new.'
            : 'Choose no when the change only changes form, size, shape, state, or dissolves without making a new substance.'
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartPhysicalChemicalChangeTutor(text) {
  if (!text || isPurePhysicalChemicalChangeDefinitionQuestion(text)) return false;
  if (isFormulaCalculationPrompt(text)) return false;
  if (!asksForPhysicalChemicalChangeIdentification(text)) return false;
  return Boolean(classifyPhysicalChemicalChangePrompt(text));
}

function asksForPhysicalChemicalChangeIdentification(text) {
  return hasPhysicalChemicalChangePair(text) ||
    /\bwhich\s+(?:one\s+)?is\s+(?:a\s+)?(?:physical|chemical)\b/.test(text);
}

function classifyPhysicalChemicalChangePrompt(text) {
  const whichTarget = text.match(/\bwhich\s+(?:one\s+)?is\s+(?:a\s+)?(physical|chemical)\b/);
  if (whichTarget && hasPhysicalChemicalChangeChoiceOptions(text)) {
    return whichTarget[1];
  }

  if (hasChemicalChangeClue(text)) return 'chemical';
  if (hasPhysicalChangeClue(text)) return 'physical';
  return '';
}

function hasPhysicalChemicalChangePair(text) {
  return /\bphysical\s+or\s+chemical\s+change\b/.test(text) ||
    /\bchemical\s+or\s+physical\s+change\b/.test(text) ||
    /\bphysical\s+or\s+chem\s+change\b/.test(text) ||
    /\bphysical\s+or\s+chemicle\s+change\b/.test(text);
}

function hasPhysicalChemicalChangeChoiceOptions(text) {
  return /\bor\b/.test(text) &&
    (hasPhysicalChangeClue(text) || hasChemicalChangeClue(text));
}

function hasPhysicalChangeClue(text) {
  return /\b(?:melting|melt|meltng|ice\s+melting|freezing|freeze|water\s+freezing|turns?\s+to\s+ice|paper\s+tearing|paper\s+getting\s+shredded|tearing|tear|rip|rips?|cutting\s+wood|cutting|cuting|cut|shredded|sugar\s+dissolving|dissolving|dissolve|dissapears?\s+in\s+water|still\s+sugar|no\s+new\s+substance|form\s+change|shape\s+change|state\s+change|changes?\s+(?:form|shape|state|size))\b/.test(text);
}

function hasChemicalChangeClue(text) {
  return /\b(?:wood\s+burning|wood\s+burning\s+up|burning|burn|burnt|burnt\s+black|rust\s+forming|rusting|rusts?|rust|baking\s+a\s+cake|baking|cooking\s+a\s+cake|vinegar\s+and\s+baking\s+soda\s+fizzing|baking\s+soda\s+fizzing|bubbles?|fizzing|fizz|new\s+substance|substance\s+formed|forms?\s+a\s+new\s+substance)\b/.test(text);
}

function isPurePhysicalChemicalChangeDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|the\s+)?physical\s+change\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:a\s+|the\s+)?chemical\s+change\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+physical\s+and\s+chemical\s+changes?\b/.test(text)) return true;
  if (/^how\s+are\s+physical\s+and\s+chemical\s+changes?\s+different\b/.test(text)) return true;
  if (/^(?:give|list|show)\s+examples?\s+of\s+physical\s+and\s+chemical\s+changes?\b/.test(text)) return true;
  if (/\bsigns?\s+of\s+a\s+chemical\s+change\b/.test(text)) return true;
  return false;
}

function isFormulaCalculationPrompt(text) {
  return /\b(?:calculate|find|solve|determine|compute)\b/.test(text);
}

function getPhysicalChemicalChangeFinalAnswer(classification) {
  if (classification === 'chemical') {
    return 'This describes a chemical change because a new substance is formed.';
  }
  return 'This describes a physical change because the substance changes form, size, shape, or state but does not become a new substance.';
}

function normalizePhysicalChemicalChangeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\bchemicle\b/g, 'chemical')
    .replace(/\bchem\b/g, 'chemical')
    .replace(/\bvineger\b/g, 'vinegar')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MIXTURE_CLASSIFICATION_TRIGGER_WORDS = [
  'homogeneous',
  'homogenous',
  'homo',
  'heterogeneous',
  'heterogenous',
  'hetrogeneous',
  'hetrogenous',
  'hetero',
  'retro mixture'
];

const MIXTURE_EXAMPLES = [
  {
    patterns: [/\bsalt\s*water\b/, /\bsaltwater\b/],
    display: 'Salt water',
    classification: 'homogeneous',
    reason: 'it is the same throughout'
  },
  {
    patterns: [/\bkool\s*-?\s*aid\b/, /\bkoolaid\b/],
    display: 'Kool-Aid',
    classification: 'homogeneous',
    reason: 'it is the same throughout'
  },
  {
    patterns: [/\bair\b/],
    display: 'Air',
    classification: 'homogeneous',
    reason: 'it is the same throughout'
  },
  {
    patterns: [/\bvinegar\b/],
    display: 'Vinegar',
    classification: 'homogeneous',
    reason: 'it is the same throughout'
  },
  {
    patterns: [/\bcereal\s+(?:in|and|with)\s+milk\b/, /\bmilk\s+(?:and|with)\s+cereal\b/],
    display: 'Cereal in milk',
    classification: 'heterogeneous',
    reason: 'you can see different parts'
  },
  {
    patterns: [/\btrail\s+mix\b/],
    display: 'Trail mix',
    classification: 'heterogeneous',
    reason: 'you can see different parts'
  },
  {
    patterns: [/\b(?:olive\s+)?oil\s+(?:and|in|with)\s+water\b/, /\bwater\s+(?:and|with)\s+(?:olive\s+)?oil\b/],
    display: 'Oil and water',
    classification: 'heterogeneous',
    reason: 'you can see different parts'
  },
  {
    patterns: [/\bsand\s+(?:and|in|with)\s+water\b/, /\bwater\s+(?:and|with)\s+sand\b/],
    display: 'Sand and water',
    classification: 'heterogeneous',
    reason: 'you can see different parts'
  },
  {
    patterns: [/\bsalad\b(?!\s+dressing)/],
    display: 'Salad',
    classification: 'heterogeneous',
    reason: 'you can see different parts'
  }
];

function buildMixtureConceptTutorPattern(message) {
  const text = normalizeMixtureText(message);
  if (!shouldStartMixtureClassificationTutor(text)) return null;

  const knownExample = findKnownMixtureExample(text);
  const example = knownExample || buildUnknownMixtureExample(message);
  if (!example) return null;

  const sameFinalAnswer = `${example.display} is a homogeneous mixture because it is the same throughout.`;
  const differentFinalAnswer = `${example.display} is a heterogeneous mixture because you can see different parts.`;
  const knownClassification = example.classification || '';

  return {
    id: 'matter.mixtures.homogeneous-heterogeneous',
    topic: 'homogeneous and heterogeneous mixtures',
    originalQuestion: String(message || '').trim(),
    supportedExample: Boolean(knownExample),
    steps: [
      {
        id: 'same-or-different-throughout',
        type: 'choice',
        prompt: 'Is it the same throughout, or can you see different parts?',
        choices: [
          {
            number: 1,
            label: 'Same throughout',
            value: 'same',
            correct: knownClassification ? knownClassification === 'homogeneous' : true,
            finalAnswer: sameFinalAnswer
          },
          {
            number: 2,
            label: 'Different parts',
            value: 'different',
            correct: knownClassification ? knownClassification === 'heterogeneous' : true,
            finalAnswer: differentFinalAnswer
          }
        ],
        correctAnswer: knownClassification === 'heterogeneous' ? 'different' : 'same',
        hints: [
          'Think about whether the mixture looks uniform or whether separate parts stand out.',
          knownClassification === 'heterogeneous'
            ? 'Pick different parts when the pieces or layers are visible.'
            : 'Pick same throughout when the mixture looks uniform all the way through.'
        ]
      }
    ],
    finalAnswer: knownClassification === 'heterogeneous' ? differentFinalAnswer : sameFinalAnswer,
    finalExplanation: knownClassification === 'heterogeneous' ? differentFinalAnswer : sameFinalAnswer
  };
}

function shouldStartMixtureClassificationTutor(text) {
  if (!text || isPureMixtureDefinitionQuestion(text)) return false;
  if (!hasMixtureClassificationTrigger(text)) return false;
  if (/\b(?:quiz|test|practice)\s+me\b/.test(text)) return false;

  const hasKnownExample = Boolean(findKnownMixtureExample(text));
  const asksClassification = /\b(?:is|are|would|will|could|classify|type|kind)\b/.test(text) ||
    /\b(?:homo|hetero)\s+mixture\b/.test(text) ||
    /\bretro\s+mixture\b/.test(text);
  const hasSubjectBeforeClassification = /^(?:is|are|would|will|could)\s+.+?\s+(?:be\s+)?(?:a\s+|an\s+)?(?:homo|hetero|homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous|retro)\b/.test(text);
  const hasExampleSignal = hasKnownExample ||
    hasSubjectBeforeClassification ||
    /:\s*\S/.test(text) ||
    /\b(?:this|it|that|sample|substance|example|mixture)\b/.test(text);

  return asksClassification && hasExampleSignal;
}

function isPureMixtureDefinitionQuestion(text) {
  if (/^(?:define|definition of)\s+(?:a\s+)?(?:homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous|homo|hetero)(?:\s+mixtures?)?$/.test(text)) {
    return true;
  }
  if (/^what\s+does\s+(?:a\s+)?(?:homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous|homo|hetero)(?:\s+mixtures?)?\s+mean$/.test(text)) {
    return true;
  }
  if (/^what\s+(?:is|are)\s+(?:a\s+|an\s+)?(?:homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous)(?:\s+mixtures?)?$/.test(text)) {
    return true;
  }
  if (/\b(?:difference|different|vs|versus|compare)\b/.test(text) && hasHomogeneousTrigger(text) && hasHeterogeneousTrigger(text)) {
    return true;
  }
  if (/^(?:explain|describe|summarize)\b/.test(text) && hasHomogeneousTrigger(text) && hasHeterogeneousTrigger(text) && !/\b(?:is|are|would|classify)\b.+\b(?:homo|hetero|homogeneous|heterogeneous|homogenous|heterogenous|hetrogeneous|hetrogenous)\b/.test(text)) {
    return true;
  }
  return false;
}

function hasMixtureClassificationTrigger(text) {
  return hasHomogeneousTrigger(text) || hasHeterogeneousTrigger(text) || /\bretro\s+mixture\b/.test(text);
}

function hasHomogeneousTrigger(text) {
  return /\b(?:homogeneous|homogenous|homo)\b/.test(text);
}

function hasHeterogeneousTrigger(text) {
  return /\b(?:heterogeneous|heterogenous|hetrogeneous|hetrogenous|hetero)\b/.test(text);
}

function findKnownMixtureExample(text) {
  return MIXTURE_EXAMPLES.find((example) => example.patterns.some((pattern) => pattern.test(text))) || null;
}

function buildUnknownMixtureExample(message) {
  const raw = String(message || '').trim();
  const text = normalizeMixtureText(raw);

  const colonMatch = raw.match(/:\s*([^?!.]+)[?!.]*$/);
  if (colonMatch) return { display: titleCaseExample(colonMatch[1]) };

  const beforeIs = text.match(/^(?:is|are|would|will|could)\s+(.+?)\s+(?:a\s+|an\s+)?(?:homo|hetero|homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous|retro)\b/);
  if (beforeIs) return { display: titleCaseExample(beforeIs[1]) };

  const afterClassify = text.match(/\bclassify\s+(.+?)\s+(?:as\s+)?(?:homo|hetero|homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous)\b/);
  if (afterClassify) return { display: titleCaseExample(afterClassify[1]) };

  if (/\b(?:this|it|that|sample|substance|example|mixture)\b/.test(text)) {
    return { display: 'This mixture' };
  }

  return null;
}

function titleCaseExample(value) {
  const cleaned = String(value || '')
    .replace(/\b(?:this|that|it|a|an|the|be|is|are|would|will|could|mixture)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'This mixture';

  return cleaned
    .split(/\s+/)
    .map((word) => {
      if (/^kool-?aid$/i.test(word)) return 'Kool-Aid';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function normalizeMixtureText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ELEMENT_EXAMPLES = [
  ...[
    'hydrogen',
    'helium',
    'carbon',
    'oxygen',
    'nitrogen',
    'gold',
    'silver',
    'copper',
    'iron',
    'aluminum',
    'sodium',
    'chlorine',
    'calcium',
    'potassium',
    'magnesium',
    'silicon',
    'sulfur',
    'phosphorus',
    'zinc',
    'nickel',
    'lead',
    'mercury'
  ].map((name) => ({
    patterns: [new RegExp(`\\b${name}\\b`)],
    display: titleCaseElementCompoundMixtureExample(name),
    classification: 'element',
    reason: 'it is made of one kind of atom'
  })),
  ...[
    ['au', 'Au'],
    ['ag', 'Ag'],
    ['fe', 'Fe'],
    ['cu', 'Cu'],
    ['al', 'Al'],
    ['na', 'Na'],
    ['cl', 'Cl'],
    ['ca', 'Ca'],
    ['mg', 'Mg'],
    ['zn', 'Zn'],
    ['he', 'He'],
    ['ne', 'Ne'],
    ['ar', 'Ar']
  ].map(([symbol, display]) => ({
    patterns: [new RegExp(`\\b${symbol}\\b`)],
    display,
    classification: 'element',
    reason: 'it is the chemical symbol for one kind of atom'
  }))
];

const COMPOUND_EXAMPLES = [
  {
    patterns: [/\bwater\b/, /\bh2o\b/],
    display: 'Water',
    classification: 'compound',
    reason: 'hydrogen and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bcarbon\s+dioxide\b/, /\bco2\b/],
    display: 'Carbon dioxide',
    classification: 'compound',
    reason: 'carbon and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bcarbon\s+monoxide\b/, /\bco\b/],
    display: 'Carbon monoxide',
    classification: 'compound',
    reason: 'carbon and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bsodium\s+chloride\b/, /\bnacl\b/, /\btable\s+salt\b/, /\bpure\s+salt\b/, /\bsalt\b/],
    display: 'Salt',
    classification: 'compound',
    reason: 'sodium and chlorine are chemically joined into one substance'
  },
  {
    patterns: [/\bcalcium\s+carbonate\b/, /\bcaco3\b/],
    display: 'Calcium carbonate',
    classification: 'compound',
    reason: 'its atoms are chemically joined into one substance'
  },
  {
    patterns: [/\bbaking\s+soda\b/, /\bsodium\s+bicarbonate\b/, /\bnahco3\b/],
    display: 'Baking soda',
    classification: 'compound',
    reason: 'its atoms are chemically joined into one substance'
  },
  {
    patterns: [/\bsugar\b/, /\bsucrose\b/, /\bc12h22o11\b/],
    display: 'Sugar',
    classification: 'compound',
    reason: 'carbon, hydrogen, and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bglucose\b/, /\bc6h12o6\b/],
    display: 'Glucose',
    classification: 'compound',
    reason: 'carbon, hydrogen, and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bmethane\b/, /\bch4\b/],
    display: 'Methane',
    classification: 'compound',
    reason: 'carbon and hydrogen are chemically joined into one substance'
  },
  {
    patterns: [/\bammonia\b/, /\bnh3\b/],
    display: 'Ammonia',
    classification: 'compound',
    reason: 'nitrogen and hydrogen are chemically joined into one substance'
  },
  {
    patterns: [/\bhydrochloric\s+acid\b/, /\bhcl\b/],
    display: 'Hydrochloric acid',
    classification: 'compound',
    reason: 'hydrogen and chlorine are chemically joined into one substance'
  },
  {
    patterns: [/\bacetic\s+acid\b/, /\bch3cooh\b/],
    display: 'Acetic acid',
    classification: 'compound',
    reason: 'its atoms are chemically joined into one substance'
  },
  {
    patterns: [/\bhydrogen\s+peroxide\b/, /\bh2o2\b/],
    display: 'Hydrogen peroxide',
    classification: 'compound',
    reason: 'hydrogen and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\brust\b/, /\biron\s+oxide\b/, /\bfe2o3\b/],
    display: 'Rust',
    classification: 'compound',
    reason: 'iron and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bsilicon\s+dioxide\b/, /\bsio2\b/, /\bpure\s+sand\b/],
    display: 'Sand',
    classification: 'compound',
    reason: 'silicon and oxygen are chemically joined into one substance'
  }
];

const ELEMENT_COMPOUND_MIXTURE_MIXTURE_EXAMPLES = [
  {
    patterns: [/\bsalt\s*water\b/, /\bsaltwater\b/, /\bsea\s*water\b/, /\bseawater\b/],
    display: 'Salt water',
    classification: 'mixture',
    reason: 'salt and water are physically mixed together'
  },
  {
    patterns: [/\bair\b/],
    display: 'Air',
    classification: 'mixture',
    reason: 'different gases are physically mixed together'
  },
  {
    patterns: [/\bsalad\b/, /\btrail\s+mix\b/, /\bcereal\s+(?:in|and|with)\s+milk\b/, /\bmilk\s+(?:and|with)\s+cereal\b/],
    display: 'This sample',
    classification: 'mixture',
    reason: 'the parts are physically mixed together'
  },
  {
    patterns: [/\b(?:olive\s+)?oil\s+(?:and|in|with)\s+water\b/, /\bwater\s+(?:and|with)\s+(?:olive\s+)?oil\b/],
    display: 'Oil and water',
    classification: 'mixture',
    reason: 'oil and water are physically mixed together'
  },
  {
    patterns: [/\bsand\s+(?:and|in|with)\s+water\b/, /\bwater\s+(?:and|with)\s+sand\b/],
    display: 'Sand and water',
    classification: 'mixture',
    reason: 'sand and water are physically mixed together'
  },
  {
    patterns: [/\blemonade\b/, /\bkool\s*-?\s*aid\b/, /\bkoolaid\b/, /\bmilk\b/, /\bpaint\b/, /\bsoil\b/, /\bconcrete\b/],
    display: 'This product',
    classification: 'mixture',
    reason: 'its parts are physically mixed together'
  },
  {
    patterns: [/\bbrass\b/, /\bsteel\b/],
    display: 'This alloy',
    classification: 'mixture',
    reason: 'metals are physically mixed together'
  },
  {
    patterns: [/\bvinegar\b/, /\bbleach\b/, /(?<!\bbaking\s)\bsoda\b/, /\bpop\b/, /\borange\s+juice\b/, /\bcoffee\b/, /\btea\b/],
    display: 'This product',
    classification: 'mixture',
    reason: 'its ingredients are physically mixed together'
  },
  {
    patterns: [/\bshampoo\b/, /\bdish\s+soap\b/, /\blaundry\s+detergent\b/, /\bhand\s+sanitizer\b/, /\bgasoline\b/],
    display: 'This product',
    classification: 'mixture',
    reason: 'its ingredients are physically mixed together'
  }
];

function buildElementCompoundMixtureConceptTutorPattern(message) {
  const text = normalizeElementCompoundMixtureText(message);
  if (!shouldStartElementCompoundMixtureTutor(text)) return null;

  const knownExample = findKnownElementCompoundMixtureExample(text);
  const example = knownExample || buildUnknownElementCompoundMixtureExample(message);
  if (!example) return null;

  const elementFinalAnswer = `${example.display} is an element because ${example.reason || 'it is made of one kind of atom'}.`;
  const compoundFinalAnswer = `${example.display} is a compound because ${example.reason || 'the atoms are chemically joined into a new substance'}.`;
  const mixtureFinalAnswer = `${example.display} is a mixture because ${example.reason || 'the parts are physically mixed together'}.`;
  const unknownElementFinalAnswer = `${example.display} is an element because it is made of one kind of atom.`;
  const unknownCompoundFinalAnswer = `${example.display} is a compound because the atoms are chemically joined into a new substance.`;
  const unknownMixtureFinalAnswer = `${example.display} is a mixture because the parts are physically mixed together.`;
  const classification = example.classification || '';

  return {
    id: 'matter.element-compound-mixture',
    topic: 'elements, compounds, and mixtures',
    originalQuestion: String(message || '').trim(),
    supportedExample: Boolean(knownExample),
    steps: [
      {
        id: 'one-kind-of-atom',
        type: 'choice',
        prompt: 'Is it made of one kind of atom?',
        choices: [
          {
            number: 1,
            label: 'Yes',
            value: 'yes',
            correct: classification ? classification === 'element' : true,
            completeTutor: true,
            finalAnswer: classification === 'element' ? elementFinalAnswer : unknownElementFinalAnswer
          },
          {
            number: 2,
            label: 'No',
            value: 'no',
            correct: classification ? classification !== 'element' : true,
            nextStepId: 'chemically-joined-or-physically-mixed'
          }
        ],
        correctAnswer: classification === 'element' ? 'yes' : 'no',
        hints: [
          'An element has only one kind of atom.',
          classification === 'element'
            ? 'Choose yes when the sample is one element from the periodic table.'
            : 'Choose no when more than one kind of particle is involved.'
        ]
      },
      {
        id: 'chemically-joined-or-physically-mixed',
        type: 'choice',
        prompt: 'Are the parts chemically joined into a new substance, or physically mixed together?',
        choices: [
          {
            number: 1,
            label: 'Chemically joined into a new substance',
            value: 'chemically joined',
            correct: classification ? classification === 'compound' : true,
            finalAnswer: classification === 'compound' ? compoundFinalAnswer : unknownCompoundFinalAnswer
          },
          {
            number: 2,
            label: 'Physically mixed together',
            value: 'physically mixed',
            correct: classification ? classification === 'mixture' : true,
            finalAnswer: classification === 'mixture' ? mixtureFinalAnswer : unknownMixtureFinalAnswer
          }
        ],
        correctAnswer: classification === 'mixture' ? 'physically mixed' : 'chemically joined',
        hints: [
          'A compound has chemically joined atoms. A mixture has parts physically mixed together.',
          classification === 'mixture'
            ? 'Choose physically mixed together when the parts keep their own identities.'
            : 'Choose chemically joined when the atoms make one new substance.'
        ]
      }
    ],
    finalAnswer: classification === 'element'
      ? elementFinalAnswer
      : classification === 'mixture'
        ? mixtureFinalAnswer
        : compoundFinalAnswer,
    finalExplanation: classification === 'element'
      ? elementFinalAnswer
      : classification === 'mixture'
        ? mixtureFinalAnswer
        : compoundFinalAnswer
  };
}

function shouldStartElementCompoundMixtureTutor(text) {
  if (!text || isPureElementCompoundMixtureDefinitionQuestion(text)) return false;
  if (hasMixtureClassificationTrigger(text)) return false;
  if (/\b(?:quiz|test|practice)\s+me\b/.test(text)) return false;
  if (/^are\b/.test(text) && !hasElementCompoundMixtureChoicePhrase(text)) return false;
  if (!hasElementCompoundMixtureTrigger(text)) return false;

  const hasKnownExample = Boolean(findKnownElementCompoundMixtureExample(text));
  const asksClassification = /^(?:is|are|would|will|could|can)\b/.test(text) ||
    /\bclassify\b/.test(text) ||
    hasElementCompoundMixtureChoicePhrase(text);
  const hasExampleSignal = hasKnownExample ||
    /:\s*\S/.test(text) ||
    /\b(?:this|it|that|sample|substance|example|material|object|thing)\b/.test(text) ||
    /^(?:is|are|would|will|could|can)\s+.+?\s+(?:be\s+)?(?:an?\s+)?(?:element|compound|mixture)\b/.test(text) ||
    hasElementCompoundMixtureChoicePhrase(text);

  return asksClassification && hasExampleSignal;
}

function isPureElementCompoundMixtureDefinitionQuestion(text) {
  if (/^(?:define|definition of)\s+(?:an?\s+)?(?:element|compound|mixture)s?$/.test(text)) return true;
  if (/^what\s+does\s+(?:an?\s+)?(?:element|compound|mixture)s?\s+mean$/.test(text)) return true;
  if (/^what\s+(?:is|are)\s+(?:an?\s+)?(?:element|compound|mixture)s?$/.test(text)) return true;
  if (/\b(?:difference|different|vs|versus|compare)\b/.test(text) && /\belements?\b/.test(text) && /\bcompounds?\b/.test(text)) return true;
  if (/^(?:explain|describe|summarize)\b/.test(text) && /\belements?\b/.test(text) && /\bcompounds?\b/.test(text) && /\bmixtures?\b/.test(text)) return true;
  return false;
}

function hasElementCompoundMixtureTrigger(text) {
  return /\belements?\b|\bcompounds?\b|\bmixtures?\b/.test(text);
}

function hasElementCompoundMixtureChoicePhrase(text) {
  return /\b(?:element\s+or\s+compound|compound\s+or\s+mixture|element\s+compound\s+or\s+mixture|element\s+or\s+compound\s+or\s+mixture)\b/.test(text);
}

function findKnownElementCompoundMixtureExample(text) {
  const examples = [
    ...ELEMENT_COMPOUND_MIXTURE_MIXTURE_EXAMPLES,
    ...COMPOUND_EXAMPLES,
    ...ELEMENT_EXAMPLES
  ];
  const match = examples.find((example) => example.patterns.some((pattern) => pattern.test(text))) || null;
  if (!match) return null;
  return {
    ...match,
    display: refineKnownElementCompoundMixtureDisplay(match, text)
  };
}

function refineKnownElementCompoundMixtureDisplay(example, text) {
  const patternDisplay = [
    [/\btrail\s+mix\b/, 'Trail mix'],
    [/\bcereal\s+(?:in|and|with)\s+milk\b|\bmilk\s+(?:and|with)\s+cereal\b/, 'Cereal in milk'],
    [/\bsalad\b/, 'Salad'],
    [/\blemonade\b/, 'Lemonade'],
    [/\bkool\s*-?\s*aid\b|\bkoolaid\b/, 'Kool-Aid'],
    [/\bmilk\b/, 'Milk'],
    [/\bpaint\b/, 'Paint'],
    [/\bsoil\b/, 'Soil'],
    [/\bconcrete\b/, 'Concrete'],
    [/\bbrass\b/, 'Brass'],
    [/\bsteel\b/, 'Steel'],
    [/\bvinegar\b/, 'Vinegar'],
    [/\bbleach\b/, 'Bleach'],
    [/(?<!\bbaking\s)\bsoda\b|\bpop\b/, 'Soda'],
    [/\borange\s+juice\b/, 'Orange juice'],
    [/\bcoffee\b/, 'Coffee'],
    [/\btea\b/, 'Tea'],
    [/\bshampoo\b/, 'Shampoo'],
    [/\bdish\s+soap\b/, 'Dish soap'],
    [/\blaundry\s+detergent\b/, 'Laundry detergent'],
    [/\bhand\s+sanitizer\b/, 'Hand sanitizer'],
    [/\bgasoline\b/, 'Gasoline']
  ];
  const displayMatch = patternDisplay.find(([pattern]) => pattern.test(text));
  return displayMatch ? displayMatch[1] : example.display;
}

function buildUnknownElementCompoundMixtureExample(message) {
  const raw = String(message || '').trim();
  const text = normalizeElementCompoundMixtureText(raw);

  const colonMatch = raw.match(/:\s*([^?!.]+)[?!.]*$/);
  if (colonMatch) return { display: titleCaseElementCompoundMixtureExample(colonMatch[1]) };

  const beforeClassification = text.match(/^(?:is|are|would|will|could|can)\s+(.+?)\s+(?:be\s+)?(?:an?\s+)?(?:element|compound|mixture)\b/);
  if (beforeClassification) return { display: titleCaseElementCompoundMixtureExample(beforeClassification[1]) };

  const afterClassify = text.match(/\bclassify\s+(.+?)\s+(?:as\s+)?(?:an?\s+)?(?:element|compound|mixture)\b/);
  if (afterClassify) return { display: titleCaseElementCompoundMixtureExample(afterClassify[1]) };

  if (/\b(?:this|it|that|sample|substance|example|material|object|thing)\b/.test(text)) {
    return { display: 'This substance' };
  }

  if (/\b(?:element\s+or\s+compound|compound\s+or\s+mixture|element\s+compound\s+or\s+mixture|element\s+or\s+compound\s+or\s+mixture)\b/.test(text)) {
    return { display: 'This substance' };
  }

  return null;
}

function titleCaseElementCompoundMixtureExample(value) {
  const cleaned = String(value || '')
    .replace(/\b(?:this|that|it|a|an|the|be|is|are|would|will|could|can|element|compound|mixture|classify|as)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'This substance';

  return cleaned
    .split(/\s+/)
    .map((word) => {
      if (/^kool-?aid$/i.test(word)) return 'Kool-Aid';
      if (/^[A-Z][a-z]?$/.test(word)) return word;
      if (/^[A-Z][a-z]?[0-9]/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function normalizeElementCompoundMixtureText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildUnit7AtomicStructureConceptTutorPattern(message) {
  const text = normalizeUnit7AtomicStructureText(message);
  if (!text || isPureUnit7AtomicDefinitionQuestion(text) || isUnit7AtomicFormulaPrompt(text) || isUnit7AtomicComparisonPrompt(text) || isUnit7AtomicOpenResponsePrompt(text)) return null;

  const classification = classifyUnit7AtomicConceptTutor(text);
  if (!classification) return null;

  const finalAnswer = getUnit7AtomicConceptFinalAnswer(classification);
  return {
    id: classification.id,
    topic: classification.topic,
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: classification.triggerGroup,
    steps: [
      {
        id: classification.stepId,
        type: 'choice',
        prompt: classification.prompt,
        choices: classification.choices.map((choice) => ({
          ...choice,
          correct: choice.value === classification.answer,
          finalAnswer: choice.value === classification.answer ? finalAnswer : undefined
        })),
        correctAnswer: classification.answer,
        hints: classification.hints
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function isUnit7AtomicComparisonPrompt(text) {
  if (/\b(?:which\s+clue|clue\s+shows|evidence|best matches|classify|classification)\b/.test(text)) return false;
  return /\b(?:compare|comparison|difference|diffrence|different|alike|vs|versus|same and different|similarities?|similarities and differences)\b/.test(text);
}

function isUnit7AtomicOpenResponsePrompt(text) {
  return /\bnucleus\b.*\bpositive\b.*\belectron cloud\b.*\bnegative\b/.test(text) ||
    /\bcharge\b.*\bnucleus\b.*\belectron cloud\b/.test(text) ||
    /\bmass\b.*\bnucleus\b.*\bvolume\b.*\belectron cloud\b/.test(text);
}

function classifyUnit7AtomicConceptTutor(text) {
  const periodicClue = classifyUnit7PeriodicClue(text);
  if (periodicClue) return periodicClue;

  const modelClue = classifyUnit7AtomicModelClue(text);
  if (modelClue) return modelClue;

  const isotopeClue = classifyUnit7IsotopeClue(text);
  if (isotopeClue) return isotopeClue;

  const classificationClue = classifyUnit7ElementClassificationClue(text);
  if (classificationClue) return classificationClue;

  return null;
}

function classifyUnit7PeriodicClue(text) {
  if (!/\b(?:same group|same period|valence electrons?|energy levels?|identify element|atomic number|group or period|group period)\b/.test(text)) return null;
  let answer = '';
  let triggerGroup = '';
  if (/\bsame\s+group\b.*\b(?:similar|properties|react|act)\b|\bsimilar\b.*\bsame\s+group\b|\bgroup\b.*\bsame\s+valence\s+electrons?\b|\bsame\s+valence\s+electrons?\b.*\bgroup\b/.test(text)) {
    answer = 'valence_electrons';
    triggerGroup = 'same-group-similar-properties';
  } else if (/\bsame\s+period\b|\bperiod\b.*\benergy\s+levels?\b/.test(text)) {
    answer = 'energy_levels';
    triggerGroup = 'same-period-energy-levels';
  } else if (/\bidentify\b.*\belement\b|\bidentifies\b.*\belement\b|\bproton\s+count\b.*\bidentif|\batomic\s+number\b.*\bunique\b/.test(text)) {
    answer = 'atomic_number';
    triggerGroup = 'atomic-number-identity';
  } else if (/\bvertical\s+columns?\b|\bcolumns?\b/.test(text)) {
    answer = 'group';
    triggerGroup = 'vertical-columns';
  } else if (/\bhorizontal\s+rows?\b|\brows?\b/.test(text)) {
    answer = 'period';
    triggerGroup = 'horizontal-rows';
  }
  if (!answer) return null;
  return {
    id: 'unit7.periodic_table.clue.identification',
    topic: 'periodic table clue identification',
    triggerGroup,
    stepId: 'identify-periodic-table-clue',
    prompt: 'Which periodic table idea does the clue point to?',
    answer,
    choices: [
      { number: 1, label: 'Group: a vertical column', value: 'group' },
      { number: 2, label: 'Period: a horizontal row', value: 'period' },
      { number: 3, label: 'Valence electrons: outer electrons that explain similar group properties', value: 'valence_electrons' },
      { number: 4, label: 'Energy levels: shell count shown by period number', value: 'energy_levels' },
      { number: 5, label: 'Atomic number: proton count that identifies the element', value: 'atomic_number' }
    ],
    hints: [
      'Look for whether the clue is about columns, rows, outer electrons, shells, or element identity.',
      'Same group properties come from valence electrons; same period means energy levels.'
    ]
  };
}

function classifyUnit7AtomicModelClue(text) {
  if (!/\b(?:bohr|electron cloud|fixed orbit|fixed path|regions? of space|model)\b/.test(text)) return null;
  if (!/\b(?:which|what|model|evidence|clue|fixed|region|orbit|cloud|difference|diffrence)\b/.test(text)) return null;
  const answer = /\b(?:fixed orbit|fixed orbits|fixed path|energy levels?|shells?)\b/.test(text)
    ? 'bohr'
    : /\b(?:regions? of space|not fixed|probability|cloud)\b/.test(text)
      ? 'electron_cloud'
      : '';
  if (!answer) return null;
  return {
    id: 'unit7.atomic_models.identification',
    topic: 'atomic model identification',
    triggerGroup: answer,
    stepId: 'identify-atomic-model',
    prompt: 'Which atomic model matches the evidence?',
    answer,
    choices: [
      { number: 1, label: 'Bohr model: electrons in fixed orbits or energy levels', value: 'bohr' },
      { number: 2, label: 'Electron cloud model: electrons in regions of space, not fixed paths', value: 'electron_cloud' },
      { number: 3, label: 'Plum pudding model: electrons embedded in a positive atom', value: 'plum_pudding' }
    ],
    hints: [
      'Fixed orbit language points to Bohr; regions of space points to the electron cloud model.',
      'Choose the model whose evidence words match the clue.'
    ]
  };
}

function classifyUnit7IsotopeClue(text) {
  if (!/\bisotopes?\b/.test(text)) return null;
  if (!/\b(?:same|different|which|clue|identif|protons?|neutrons?|mass number)\b/.test(text)) return null;
  return {
    id: 'unit7.isotopes.sameness.identification',
    topic: 'isotope identification',
    triggerGroup: 'same-protons-different-neutrons',
    stepId: 'identify-isotope-clue',
    prompt: 'Which clue shows that atoms are isotopes?',
    answer: 'same_protons_different_neutrons',
    choices: [
      { number: 1, label: 'Same protons, different neutrons', value: 'same_protons_different_neutrons' },
      { number: 2, label: 'Different protons, same neutrons', value: 'different_protons_same_neutrons' },
      { number: 3, label: 'Same electrons, different element names', value: 'same_electrons_different_elements' }
    ],
    hints: [
      'Isotopes are the same element, so the proton number stays the same.',
      'Choose the clue with same protons and different neutrons.'
    ]
  };
}

function classifyUnit7ElementClassificationClue(text) {
  if (!/\b(?:metal|nonmetal|metalloid|metaloid|semiconductor|stair step|shiny|malleable|ductile|poor conductor|good conductor|brittle|tellurium|argon|fluorine|sodium|aluminum|hydrogen)\b/.test(text)) return null;
  if (!/\b(?:classify|classification|which|what type|properties|location|left|right|stair step|semiconductor|poor conductor|good conductor|brittle|shiny|malleable|ductile)\b/.test(text)) return null;
  let answer = '';
  if (/\b(?:metalloid|metaloid|semiconductor|stair step|tellurium|te)\b/.test(text)) answer = 'metalloid';
  else if (/\b(?:nonmetal|poor conductor|dull|brittle|argon|fluorine|hydrogen)\b/.test(text)) answer = 'nonmetal';
  else if (/\b(?:metal|shiny|malleable|ductile|good conductor|sodium|aluminum)\b/.test(text)) answer = 'metal';
  if (!answer) return null;
  return {
    id: 'unit7.element_classification.identification',
    topic: 'element classification',
    triggerGroup: answer,
    stepId: 'identify-element-classification',
    prompt: 'Which element classification best matches the clue?',
    answer,
    choices: [
      { number: 1, label: 'Metal: left side, shiny, malleable, ductile, good conductor', value: 'metal' },
      { number: 2, label: 'Nonmetal: right side or hydrogen, poor conductor, gas or dull brittle solid', value: 'nonmetal' },
      { number: 3, label: 'Metalloid: stair-step area, semiconductor, mixed properties', value: 'metalloid' }
    ],
    hints: [
      'Use the location or property clue, not just the element name.',
      'Semiconductor or stair-step means metalloid.'
    ]
  };
}

function getUnit7AtomicConceptFinalAnswer(classification) {
  const answers = {
    group: 'The clue points to a group because groups are vertical columns on the periodic table.',
    period: 'The clue points to a period because periods are horizontal rows on the periodic table.',
    valence_electrons: 'The clue points to valence electrons because elements in the same group have the same number of outer electrons and similar properties.',
    energy_levels: 'The clue points to energy levels because elements in the same period have the same number of electron shells.',
    atomic_number: 'The clue points to atomic number because atomic number is the proton count that identifies an element.',
    bohr: 'The Bohr model matches because it shows electrons in fixed orbits or energy levels.',
    electron_cloud: 'The electron cloud model matches because it shows electrons in regions of space instead of fixed paths.',
    same_protons_different_neutrons: 'Those atoms are isotopes because they have the same number of protons but different numbers of neutrons.',
    metal: 'The element is a metal because the clue matches metal properties or the metal side of the periodic table.',
    nonmetal: 'The element is a nonmetal because the clue matches nonmetal properties or the nonmetal side of the periodic table.',
    metalloid: 'The element is a metalloid because the clue matches the stair-step/semiconductor region with mixed properties.'
  };
  return answers[classification.answer] || 'That is the best match for the Unit 7 atomic structure clue.';
}

function isPureUnit7AtomicDefinitionQuestion(text) {
  return /^(?:what\s+is|whats|define|definition\s+of|explain|describe|tell\s+me\s+about)\b/.test(text) &&
    /\b(?:atom|element|nucleus|electron cloud|energy levels?|shells?|valence electrons?|protons?|neutrons?|electrons?|atomic number|mass number|isotopes?|isotope notation|periodic table|groups?|periods?|metals?|nonmetals?|metalloids?|bohr model)\b/.test(text);
}

function isUnit7AtomicFormulaPrompt(text) {
  return /\d/.test(text) &&
    /\b(?:calculate|find|solve|determine|how many|write|bohr)\b/.test(text) &&
    /\b(?:protons?|neutrons?|nuetrons?|electrons?|mass number|atomic number|isotope|bohr)\b/.test(text);
}

function normalizeUnit7AtomicStructureText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[-‐‑‒–—]/g, ' ')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const UNIT1_VARIABLE_SCENARIOS = [
  {
    id: 'sunlight-plant-growth',
    patterns: [
      /\bsunlight\s+affects?\s+plant\s+growth\b/,
      /\bamount\s+of\s+sunlight\b.*\bplant\s+growth\b/,
      /\bplant\s+growth\b.*\bsunlight\b/
    ],
    choices: [
      { number: 1, label: 'Amount of sunlight', value: 'amount_of_sunlight' },
      { number: 2, label: 'Plant growth', value: 'plant_growth' },
      { number: 3, label: 'Type of plant', value: 'type_of_plant' }
    ],
    answers: {
      independent: {
        value: 'amount_of_sunlight',
        phrase: 'the amount of sunlight',
        reason: 'it is what the scientist changes on purpose'
      },
      dependent: {
        value: 'plant_growth',
        phrase: 'plant growth',
        reason: 'it is what the scientist measures as the result'
      },
      constant: {
        value: 'type_of_plant',
        phrase: 'the type of plant',
        reason: 'it should be kept the same to make the test fair'
      }
    }
  },
  {
    id: 'fertilizer-plant-height',
    patterns: [
      /\bfertilizer\b.*\baffects?\b.*\bplant\s+(?:height|growth)\b/,
      /\bfertilizer\s+makes?\s+plants?\s+grow\s+taller\b/,
      /\bwhich\s+fertilizer\b.*\bplants?\s+grow\s+taller\b/,
      /\btype\s+of\s+fertilizer\b.*\bplant\s+(?:height|growth)\b/
    ],
    choices: [
      { number: 1, label: 'Type of fertilizer', value: 'type_of_fertilizer' },
      { number: 2, label: 'Plant height or growth', value: 'plant_height_growth' },
      { number: 3, label: 'Amount of water', value: 'amount_of_water' }
    ],
    answers: {
      independent: {
        value: 'type_of_fertilizer',
        phrase: 'the type of fertilizer',
        reason: 'it is what the scientist changes on purpose'
      },
      dependent: {
        value: 'plant_height_growth',
        phrase: 'plant height or growth',
        reason: 'it is what the scientist measures as the result'
      },
      constant: {
        value: 'amount_of_water',
        phrase: 'the amount of water',
        reason: 'it should be kept the same to make the test fair'
      }
    }
  },
  {
    id: 'temperature-dissolving',
    patterns: [
      /\btemperature\s+affects?\s+dissolving\b/,
      /\btemperature\b.*\b(?:dissolving|dissolve|dissolves)\b/,
      /\b(?:dissolving|dissolve|dissolves)\b.*\btemperature\b/
    ],
    choices: [
      { number: 1, label: 'Temperature', value: 'temperature' },
      { number: 2, label: 'How fast or how much dissolves', value: 'dissolving_rate_amount' },
      { number: 3, label: 'Amount of solute and water', value: 'amount_of_solute_and_water' }
    ],
    answers: {
      independent: {
        value: 'temperature',
        phrase: 'temperature',
        reason: 'it is what the scientist changes on purpose'
      },
      dependent: {
        value: 'dissolving_rate_amount',
        phrase: 'how fast or how much dissolves',
        reason: 'it is what the scientist measures as the result'
      },
      constant: {
        value: 'amount_of_solute_and_water',
        phrase: 'the amount of solute and water',
        reason: 'it should be kept the same to make the test fair'
      }
    }
  },
  {
    id: 'ramp-height-toy-car-distance',
    patterns: [
      /\bramp\s+height\b.*\b(?:toy\s+car|car)\b.*\b(?:rolls?|distance|how\s+far)\b/,
      /\b(?:toy\s+car|car)\b.*\b(?:rolls?|distance|how\s+far)\b.*\bramp\s+height\b/
    ],
    choices: [
      { number: 1, label: 'Ramp height', value: 'ramp_height' },
      { number: 2, label: 'How far the toy car rolls', value: 'toy_car_distance' },
      { number: 3, label: 'The same toy car and surface', value: 'toy_car_surface' }
    ],
    answers: {
      independent: {
        value: 'ramp_height',
        phrase: 'ramp height',
        reason: 'it is what the scientist changes on purpose'
      },
      dependent: {
        value: 'toy_car_distance',
        phrase: 'how far the toy car rolls',
        reason: 'it is what the scientist measures as the result'
      },
      constant: {
        value: 'toy_car_surface',
        phrase: 'the same toy car and surface',
        reason: 'it should be kept the same to make the test fair'
      }
    }
  },
  {
    id: 'fertilizer-control-group',
    patterns: [
      /\bnew\s+fertilizer\b.*\bplants?\b.*\b(?:no\s+fertilizer|gets?\s+fertilizer)\b/,
      /\bplants?\b.*\bnew\s+fertilizer\b.*\b(?:no\s+fertilizer|gets?\s+fertilizer)\b/
    ],
    choices: [
      { number: 1, label: 'The group with no fertilizer', value: 'no_fertilizer_group' },
      { number: 2, label: 'The group that gets fertilizer', value: 'fertilizer_group' },
      { number: 3, label: 'The plant height measurement', value: 'plant_height_measurement' }
    ],
    answers: {
      control_group: {
        value: 'no_fertilizer_group',
        phrase: 'the group with no fertilizer',
        reason: 'it did not receive the treatment or change'
      },
      experimental_group: {
        value: 'fertilizer_group',
        phrase: 'the group that gets fertilizer',
        reason: 'it received the treatment or change'
      }
    }
  },
  {
    id: 'medicine-sugar-pill-control-group',
    patterns: [
      /\bmedicine\s+test\b.*\bmedicine\b.*\bsugar\s+pill\b/,
      /\bsugar\s+pill\b.*\bmedicine\b/
    ],
    choices: [
      { number: 1, label: 'The group that takes the medicine', value: 'medicine_group' },
      { number: 2, label: 'The group that takes the sugar pill', value: 'sugar_pill_group' },
      { number: 3, label: 'The measured health result', value: 'health_result' }
    ],
    answers: {
      control_group: {
        value: 'sugar_pill_group',
        phrase: 'the group that takes the sugar pill',
        reason: 'it did not receive the medicine treatment'
      },
      experimental_group: {
        value: 'medicine_group',
        phrase: 'the group that takes the medicine',
        reason: 'it received the treatment or change'
      }
    }
  },
  {
    id: 'music-studying-control-group',
    patterns: [
      /\bmusic\b.*\bstud(?:y|ying|ies)\b.*\b(?:no\s+music|with\s+music)\b/,
      /\bstud(?:y|ying|ies)\b.*\b(?:no\s+music|with\s+music)\b.*\bmusic\b/
    ],
    choices: [
      { number: 1, label: 'The group studying with no music', value: 'no_music_group' },
      { number: 2, label: 'The group studying with music', value: 'music_group' },
      { number: 3, label: 'The test score or studying result', value: 'studying_result' }
    ],
    answers: {
      control_group: {
        value: 'no_music_group',
        phrase: 'the group studying with no music',
        reason: 'it did not receive the treatment or change'
      },
      experimental_group: {
        value: 'music_group',
        phrase: 'the group studying with music',
        reason: 'it received the treatment or change'
      }
    }
  }
];

function buildUnit1VariablesConceptTutorPattern(message) {
  const text = normalizeUnit1VariablesText(message);
  if (!shouldStartUnit1VariablesTutor(text)) return null;

  const scenario = findUnit1VariableScenario(text);
  const targets = classifyUnit1VariableTargets(text)
    .filter((target) => scenario?.answers?.[target]);
  if (!scenario || targets.length === 0) return null;

  const finalAnswer = targets
    .map((target) => getUnit1VariablesFinalAnswer(target, scenario.answers[target]))
    .join(' ');

  return {
    id: 'unit1.scientific_method.variables.identification',
    topic: 'identifying variables',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: `${scenario.id}:${targets.join('-')}`,
    steps: targets.map((target) => buildUnit1VariablesStep(scenario, target, finalAnswer)),
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function buildUnit1VariablesStep(scenario, target, finalAnswer) {
  const answer = scenario.answers[target];
  return {
    id: `identify-experiment-part-${target}`,
    type: 'choice',
    prompt: getUnit1VariablesStepPrompt(target),
    choices: scenario.choices.map((choice) => ({
      ...choice,
      correct: choice.value === answer.value,
      finalAnswer: choice.value === answer.value ? finalAnswer : undefined
    })),
    correctAnswer: answer.value,
    hints: [
      getUnit1VariablesGeneralHint(target),
      getUnit1VariablesSpecificHint(target)
    ]
  };
}

function shouldStartUnit1VariablesTutor(text) {
  if (!text || isPureUnit1ScientificMethodDefinitionQuestion(text)) return false;
  if (isUnit1VariablesFormulaCalculationPrompt(text)) return false;
  if (!findUnit1VariableScenario(text)) return false;
  return classifyUnit1VariableTargets(text).length > 0;
}

function findUnit1VariableScenario(text) {
  return UNIT1_VARIABLE_SCENARIOS.find((scenario) => (
    scenario.patterns.some((pattern) => pattern.test(text))
  )) || null;
}

function classifyUnit1VariableTarget(text) {
  return classifyUnit1VariableTargets(text)[0] || '';
}

function classifyUnit1VariableTargets(text) {
  const targets = [];
  if (/\b(?:independent\s+(?:and\s+dependent\s+)?variables?|independant\s+variables?|independent\s+varible|changed\s+on\s+purpose|changed\s+variable|manipulated\s+variable|which\s+variable\s+is\s+changed|what\s+is\s+changed\s+on\s+purpose)\b/.test(text)) {
    targets.push('independent');
  }
  if (/\b(?:dependent\s+variables?|dependant\s+variables?|dependent\s+varible|independent\s+and\s+dependent\s+variables?|measured\s+(?:as\s+)?(?:the\s+)?result|measured\s+variable|responding\s+variable|which\s+variable\s+is\s+measured|what\s+is\s+measured)\b/.test(text)) {
    targets.push('dependent');
  }
  if (/\b(?:constants?|controlled\s+variables?|controled\s+variables?|controlled\s+varible|kept\s+the\s+same|stay\s+the\s+same|stayed\s+the\s+same|should\s+be\s+kept\s+the\s+same|make\s+the\s+test\s+fair)\b/.test(text)) {
    targets.push('constant');
  }
  if (/\b(?:control\s+(?:and\s+experimental\s+)?groups?|comparison\s+group|no\s+treatment|no\s+change|does\s+not\s+receive\s+the\s+treatment|did\s+not\s+receive\s+the\s+treatment|without\s+the\s+treatment)\b/.test(text)) {
    targets.push('control_group');
  }
  if (/\b(?:experimental\s+groups?|experiment\s+group|treatment\s+group|receives?\s+the\s+treatment|received\s+the\s+treatment|gets?\s+the\s+treatment|gets?\s+the\s+change)\b/.test(text)) {
    targets.push('experimental_group');
  }
  return targets;
}

function isPureUnit1ScientificMethodDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:an?\s+|the\s+)?(?:independent\s+variable|dependent\s+variable|controlled\s+variable|constant|control\s+group|experimental\s+group|fair\s+test|scientific\s+method|hypothesis|qualitative\s+data|quantitative\s+data|inference)\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize)\s+(?:the\s+)?(?:difference|differences)\s+between\s+(?:observation\s+and\s+inference|law\s+and\s+theory|independent\s+and\s+dependent\s+variables?)\b/.test(text)) return true;
  if (/^(?:law\s+vs\s+theory|theory\s+vs\s+law)\b/.test(text)) return true;
  return false;
}

function isUnit1VariablesFormulaCalculationPrompt(text) {
  return /\b(?:calculate|find|solve|determine|compute|convert|write)\b/.test(text) &&
    (/\d/.test(text) || /\b(?:density|wave\s+speed|scientific\s+notation|standard\s+notation|km|meters?|mL|grams?|hz|frequency|wavelength)\b/.test(text));
}

function getUnit1VariablesStepPrompt(target) {
  if (target === 'dependent') return 'What is being measured or observed?';
  if (target === 'constant') return 'What stayed the same for all groups?';
  if (target === 'control_group') return 'Which group did not receive the treatment or change?';
  if (target === 'experimental_group') return 'Which group received the treatment or change?';
  return 'What did the experimenter change on purpose?';
}

function getUnit1VariablesGeneralHint(target) {
  if (target === 'dependent') return 'The dependent variable is what the scientist measures or observes as the result.';
  if (target === 'constant') return 'Constants are the things kept the same so the test is fair.';
  if (target === 'control_group') return 'The control group is the group that does not receive the treatment or change.';
  if (target === 'experimental_group') return 'The experimental group is the group that receives the treatment or change.';
  return 'The independent variable is what the scientist changes on purpose.';
}

function getUnit1VariablesSpecificHint(target) {
  if (target === 'dependent') return 'Choose the result being measured in the experiment.';
  if (target === 'constant') return 'Choose a condition that should stay the same across the groups.';
  if (target === 'control_group') return 'Choose the group used for comparison because it did not get the treatment.';
  if (target === 'experimental_group') return 'Choose the group that got the tested treatment or change.';
  return 'Choose the part that is changed on purpose.';
}

function getUnit1VariablesFinalAnswer(target, answer) {
  if (target === 'dependent') {
    return `The dependent variable is ${answer.phrase} because ${answer.reason}.`;
  }
  if (target === 'constant') {
    return `A constant is ${answer.phrase} because ${answer.reason}.`;
  }
  if (target === 'control_group') {
    return `The control group is ${answer.phrase} because ${answer.reason}.`;
  }
  if (target === 'experimental_group') {
    return `The experimental group is ${answer.phrase} because ${answer.reason}.`;
  }
  return `The independent variable is ${answer.phrase} because ${answer.reason}.`;
}

function normalizeUnit1VariablesText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const UNIT1_GRAPH_AXIS_SCENARIOS = [
  {
    id: 'sunlight-plant-growth',
    patterns: [
      /\bsunlight\s+(?:vs|versus)\s+plant\s+growth\b/,
      /\bplant\s+growth\s+(?:vs|versus)\s+sunlight\b/
    ],
    choices: [
      { number: 1, label: 'Amount of sunlight', value: 'amount_of_sunlight' },
      { number: 2, label: 'Plant growth', value: 'plant_growth' },
      { number: 3, label: 'Graph title', value: 'graph_title' }
    ],
    axes: {
      x: {
        value: 'amount_of_sunlight',
        phrase: 'the amount of sunlight',
        reason: 'it is the independent variable'
      },
      y: {
        value: 'plant_growth',
        phrase: 'plant growth',
        reason: 'it is the dependent variable'
      }
    }
  },
  {
    id: 'fertilizer-plant-height',
    patterns: [
      /\bfertilizer\s+type\s+(?:vs|versus)\s+plant\s+height\b/,
      /\bplant\s+height\s+(?:vs|versus)\s+fertilizer\s+type\b/,
      /\bfertilizer\s+type\b.*\bplant\s+(?:height|growth)\b/
    ],
    choices: [
      { number: 1, label: 'Type of fertilizer', value: 'type_of_fertilizer' },
      { number: 2, label: 'Plant height or growth', value: 'plant_height_growth' },
      { number: 3, label: 'Amount of water', value: 'amount_of_water' }
    ],
    axes: {
      x: {
        value: 'type_of_fertilizer',
        phrase: 'the type of fertilizer',
        reason: 'it is the independent variable'
      },
      y: {
        value: 'plant_height_growth',
        phrase: 'plant height or growth',
        reason: 'it is the dependent variable'
      }
    }
  },
  {
    id: 'temperature-dissolving-rate',
    patterns: [
      /\btemperature\s+(?:vs|versus)\s+dissolving\s+rate\b/,
      /\bdissolving\s+rate\s+(?:vs|versus)\s+temperature\b/,
      /\btemperature\b.*\bdissolving\s+rate\b/
    ],
    choices: [
      { number: 1, label: 'Temperature', value: 'temperature' },
      { number: 2, label: 'Dissolving rate or how fast it dissolves', value: 'dissolving_rate' },
      { number: 3, label: 'Amount of water', value: 'amount_of_water' }
    ],
    axes: {
      x: {
        value: 'temperature',
        phrase: 'temperature',
        reason: 'it is the independent variable'
      },
      y: {
        value: 'dissolving_rate',
        phrase: 'dissolving rate, or how fast it dissolves,',
        reason: 'it is the dependent variable'
      }
    }
  }
];

function buildUnit1GraphingAxisConceptTutorPattern(message) {
  const text = normalizeUnit1GraphingAxisText(message);
  if (!shouldStartUnit1GraphingAxisTutor(text)) return null;

  const scenario = findUnit1GraphAxisScenario(text);
  const axis = classifyUnit1GraphAxisTarget(text);
  if (!scenario || !axis || !scenario.axes[axis]) return null;

  const answer = scenario.axes[axis];
  const finalAnswer = getUnit1GraphAxisFinalAnswer(axis, answer);

  return {
    id: 'unit1.graphing.axes.identification',
    topic: 'graph axis identification',
    originalQuestion: String(message || '').trim(),
    supportedExample: true,
    triggerGroup: `${scenario.id}:${axis}-axis`,
    steps: [
      {
        id: 'identify-graph-axis-part',
        type: 'choice',
        prompt: axis === 'x' ? 'What should go on the x-axis?' : 'What should go on the y-axis?',
        choices: scenario.choices.map((choice) => ({
          ...choice,
          correct: choice.value === answer.value,
          finalAnswer: choice.value === answer.value ? finalAnswer : undefined
        })),
        correctAnswer: answer.value,
        hints: [
          axis === 'x'
            ? 'The independent variable usually goes on the x-axis. Choose the part changed on purpose.'
            : 'The dependent variable usually goes on the y-axis. Choose the measured result.',
          axis === 'x'
            ? 'Choose the graph part that is the independent variable.'
            : 'Choose the graph part that is the dependent variable.'
        ]
      }
    ],
    finalAnswer,
    finalExplanation: finalAnswer
  };
}

function shouldStartUnit1GraphingAxisTutor(text) {
  if (!text || isPureUnit1GraphingDefinitionQuestion(text)) return false;
  if (isUnit1VariablesFormulaCalculationPrompt(text)) return false;
  if (!/\bgraph\b/.test(text)) return false;
  if (!findUnit1GraphAxisScenario(text)) return false;
  return Boolean(classifyUnit1GraphAxisTarget(text));
}

function findUnit1GraphAxisScenario(text) {
  return UNIT1_GRAPH_AXIS_SCENARIOS.find((scenario) => (
    scenario.patterns.some((pattern) => pattern.test(text))
  )) || null;
}

function classifyUnit1GraphAxisTarget(text) {
  if (/\bx\s*axis\b/.test(text)) return 'x';
  if (/\by\s*axis\b/.test(text)) return 'y';
  return '';
}

function isPureUnit1GraphingDefinitionQuestion(text) {
  if (!/^(?:what\s+is|whats|define|definition\s+of|explain|describe|summarize|why\s+do|what\s+goes)\b/.test(text)) return false;
  return /\b(?:graph|data table|x\s*axis|y\s*axis|graph scale|interval|line graph|bar graph|trend|cer|claim evidence reasoning)\b/.test(text) &&
    !findUnit1GraphAxisScenario(text);
}

function getUnit1GraphAxisFinalAnswer(axis, answer) {
  const axisLabel = axis === 'x' ? 'x-axis' : 'y-axis';
  return `${capitalizeFirst(answer.phrase)} goes on the ${axisLabel} because ${answer.reason}.`;
}

function capitalizeFirst(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function normalizeUnit1GraphingAxisText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[-‐‑‒–—]/g, ' ')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  buildAccelerationConceptTutorPattern,
  buildAcidsBasesConceptTutorPattern,
  buildBalancedUnbalancedForcesConceptTutorPattern,
  buildDistanceDisplacementConceptTutorPattern,
  buildElementCompoundMixtureConceptTutorPattern,
  buildEndothermicExothermicConceptTutorPattern,
  buildEnergyTransferConceptTutorPattern,
  buildMechanicalElectromagneticWavesConceptTutorPattern,
  buildMechanicalEnergyTypesConceptTutorPattern,
  buildMixtureConceptTutorPattern,
  buildNewtonsLawsConceptTutorPattern,
  buildOpenClosedCircuitsConceptTutorPattern,
  buildPhysicalChemicalChangeConceptTutorPattern,
  buildReflectionRefractionAbsorptionConceptTutorPattern,
  buildReferencePointConceptTutorPattern,
  buildSeriesParallelCircuitsConceptTutorPattern,
  buildSpeedVelocityConceptTutorPattern,
  buildTransverseLongitudinalWavesConceptTutorPattern,
  buildUnit1GraphingAxisConceptTutorPattern,
  buildUnit1VariablesConceptTutorPattern,
  buildUnit7AtomicStructureConceptTutorPattern,
  buildWavePropertiesConceptTutorPattern,
  detectNewtonsLawsConceptTutorAudit,
  DEMO_CONCEPT_TUTOR_PATTERNS,
  DEMO_SAME_OR_DIFFERENT_PATTERN,
  MIXTURE_CLASSIFICATION_TRIGGER_WORDS
};
