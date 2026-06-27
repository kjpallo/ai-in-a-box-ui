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

module.exports = {
  buildBalancedUnbalancedForcesConceptTutorPattern,
  buildDistanceDisplacementConceptTutorPattern,
  buildElementCompoundMixtureConceptTutorPattern,
  buildMixtureConceptTutorPattern,
  buildNewtonsLawsConceptTutorPattern,
  buildReferencePointConceptTutorPattern,
  buildSpeedVelocityConceptTutorPattern,
  detectNewtonsLawsConceptTutorAudit,
  DEMO_CONCEPT_TUTOR_PATTERNS,
  DEMO_SAME_OR_DIFFERENT_PATTERN,
  MIXTURE_CLASSIFICATION_TRIGGER_WORDS
};
