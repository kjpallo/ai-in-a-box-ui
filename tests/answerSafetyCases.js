'use strict';

/*
 * This is intentionally a data-only fixture. Keep assertions in
 * scripts/test-answer-safety.js so the same cases can later be reused by an
 * HTTP or browser-level runner without duplicating the course expectations.
 *
 * Case schema:
 *   id                         stable diagnostic identifier
 *   expectation               teacher-approved expectation or boundary name
 *   prompt                     exact student prompt
 *   studentPath                also exercise answerStudentMessage(), after
 *                              graph answer/support replacement
 *   expected.taskType          question-contract task type
 *   expected.candidateTopics   required canonical topic(s)
 *   expected.targetConcept     requested concept/answer target
 *   expected.requiredAnswerPatterns / forbiddenAnswerPatterns
 *   expected.requiredUnits / forbiddenUnits
 *   expected.requiredTools / forbiddenTools
 *   expected.clarificationRequired
 *   expected.maxConfidence
 *   expected.allowedRouteTypes
 */

const answerSafetyCases = [
  {
    id: 'A-speed-unit-centimeters-per-minute',
    expectation: 'A',
    prompt: 'Determine the unit for speed if distance is measured in centimeters and time in minutes.',
    studentPath: true,
    expected: {
      taskType: 'unit_only',
      candidateTopics: ['motion'],
      targetConcept: 'speed',
      requiredAnswerPatterns: [/\bcm\s*(?:\/|per)\s*min(?:ute)?s?\b/i],
      forbiddenAnswerPatterns: [/\bkm\s*\/\s*h\b/i, /\bmph\b/i],
      requiredUnits: ['cm/min'],
      forbiddenUnits: ['m/s', 'km/h', 'mph'],
      requiredTools: [/^(?:teacher_approved_answer_rules|answer_intent_rules)$/],
      forbiddenTools: ['local_periodic_table'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['units_only']
    }
  },
  {
    id: 'B-balanced-forces-identification',
    expectation: 'B',
    prompt: 'Two forces equal in size and opposite in direction.',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['forces'],
      targetConcept: 'balanced_forces',
      requiredAnswerPatterns: [/\bbalanced forces?\b/i],
      forbiddenAnswerPatterns: [/\bvoltage\b/i, /\belectric (?:charge|current)\b/i],
      forbiddenTools: ['electricity_magnetism_knowledge_pack'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze', 'cloze_completion', 'definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'C-unbalanced-forces-identification',
    expectation: 'C',
    prompt: 'Two forces unequal in size and opposite in direction.',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['forces'],
      targetConcept: 'unbalanced_forces',
      requiredAnswerPatterns: [/\bunbalanced forces?\b/i],
      forbiddenAnswerPatterns: [/\bvoltage\b/i, /\belectric (?:charge|current)\b/i],
      forbiddenTools: ['electricity_magnetism_knowledge_pack'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze', 'cloze_completion', 'definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'D-net-force-identification',
    expectation: 'D',
    prompt: 'The overall forces acting on an object.',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['forces'],
      targetConcept: 'net_force',
      requiredAnswerPatterns: [/\bnet force\b/i],
      forbiddenAnswerPatterns: [/\bvoltage\b/i, /\belectric (?:charge|current)\b/i],
      forbiddenTools: ['electricity_magnetism_knowledge_pack'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze', 'cloze_completion', 'definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'E-force-not-voltage',
    expectation: 'E; force/voltage adversarial boundary',
    prompt: 'A push or pull that causes an object to stop, move, or change direction.',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['forces'],
      targetConcept: 'force',
      requiredAnswerPatterns: [/\bforce\b/i, /\bpush or pull\b/i],
      forbiddenAnswerPatterns: [/\bvoltage(?: difference)?\b/i, /\bmeasured in volts?\b/i],
      forbiddenUnits: ['V'],
      forbiddenTools: ['electricity_magnetism_knowledge_pack'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze', 'cloze_completion', 'definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'F-lamp-table-newtons-first-law',
    expectation: 'F; table/periodic-table adversarial boundary',
    prompt: 'A lamp sitting on a table is demonstrating what law?',
    studentPath: true,
    expected: {
      taskType: 'law_identification',
      candidateTopics: ['newtons_laws'],
      targetConcept: 'newtons_first_law',
      requiredAnswerPatterns: [
        /Newton(?:['’]s|s)?\s+First Law/i,
        /\b(?:remains?|stays?) at rest\b|\bbalanced forces?\b/i
      ],
      forbiddenAnswerPatterns: [
        /\bperiodic table\b/i,
        /\bgroups? (?:are|on the periodic table)\b/i,
        /\bperiods? (?:are|on the periodic table)\b/i,
        /\bvalence electrons?\b/i
      ],
      forbiddenTools: ['local_periodic_table', 'unit7_atomic_structure_knowledge'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['law_identification', 'science_concept', 'class_fact', 'definition']
    }
  },
  {
    id: 'G-moon-gravity-mass-explanation',
    expectation: 'G; Moon/Earth gravity adversarial boundary',
    prompt: 'Why is gravity on the Moon about one-sixth of Earth’s?',
    studentPath: true,
    expected: {
      taskType: 'explanation',
      candidateTopics: ['gravity'],
      targetConcept: 'moon_gravity',
      requiredAnswerPatterns: [
        /\bMoon\b/i,
        /\b(?:less|much less|smaller)\s+mass(?:ive)?\b|\bless massive\b/i
      ],
      forbiddenAnswerPatterns: [
        /gravity on the Moon is (?:about )?9\.?8\s*m\/s/i,
        /the Moon(?:'s|s)? gravity is Earth(?:'s|s)? surface gravity/i
      ],
      forbiddenTools: ['local_periodic_table'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['explanation', 'science_concept', 'class_fact', 'definition']
    }
  },
  {
    id: 'H-ground-level-gpe-zero',
    expectation: 'H',
    prompt: 'What is the gravitational potential energy of a 3 kg ball on the ground?',
    studentPath: true,
    expected: {
      taskType: 'calculation',
      candidateTopics: ['energy'],
      targetConcept: 'gravitational_potential_energy',
      requiredAnswerPatterns: [/\b0(?:\.0+)?\s*(?:J|joules?)\b/i],
      forbiddenAnswerPatterns: [
        /three classroom types of potential energy/i,
        /gravitational potential energy is stored energy without (?:a )?result/i
      ],
      requiredUnits: ['J'],
      requiredTools: ['science_formula_rules'],
      forbiddenTools: ['local_periodic_table'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['science_formula', 'calculation']
    }
  },
  {
    id: 'I-wave-through-material',
    expectation: 'I',
    prompt: 'A vibration through a material that carries energy but not matter is a ____.',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['waves'],
      targetConcept: 'wave',
      requiredAnswerPatterns: [/\bwave\b/i],
      forbiddenAnswerPatterns: [
        /\bmatter is anything\b/i,
        /\bhas mass and takes up space\b/i
      ],
      forbiddenTools: ['unit6_matter_knowledge'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze', 'cloze_completion', 'definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'J-electric-current-not-conductor',
    expectation: 'J; current/conductor adversarial boundary',
    prompt: 'The flow of electricity through a conductor is called ____.',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['circuits'],
      targetConcept: 'electric_current',
      requiredAnswerPatterns: [/\b(?:electric )?current\b/i],
      forbiddenAnswerPatterns: [
        /^A conductor is\b/i,
        /conductors are materials that allow electrons to flow/i
      ],
      requiredTools: [/^(?:teacher_approved_answer_rules|electricity_magnetism_knowledge_pack)$/],
      forbiddenTools: ['local_periodic_table'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze', 'cloze_completion', 'definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'K-resistance-slows-current',
    expectation: 'K',
    prompt: 'What slows down the flow of electricity in a circuit?',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['circuits'],
      targetConcept: 'resistance',
      requiredAnswerPatterns: [/\bresistance\b/i],
      forbiddenAnswerPatterns: [/\bconductor is a material\b/i],
      requiredTools: [/^(?:teacher_approved_answer_rules|electricity_magnetism_knowledge_pack)$/],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze', 'cloze_completion', 'definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'L-chemical-energy-is-potential',
    expectation: 'L',
    prompt: 'For this class, is chemical energy kinetic or potential energy?',
    studentPath: true,
    expected: {
      taskType: 'binary_classification',
      candidateTopics: ['energy'],
      targetConcept: 'chemical_energy',
      requiredAnswerPatterns: [/\bchemical energy\b/i, /\bpotential(?: energy)?\b/i],
      forbiddenAnswerPatterns: [/\bchemical energy is kinetic\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['binary_classification', 'science_concept', 'definition', 'class_fact']
    }
  },
  {
    id: 'L-sound-energy-is-kinetic',
    expectation: 'L',
    prompt: 'For this class, is sound energy kinetic or potential energy?',
    studentPath: true,
    expected: {
      taskType: 'binary_classification',
      candidateTopics: ['energy'],
      targetConcept: 'sound_energy',
      requiredAnswerPatterns: [/\bsound energy\b/i, /\bkinetic(?: energy)?\b/i],
      forbiddenAnswerPatterns: [/\bsound energy is potential\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['binary_classification', 'science_concept', 'definition', 'class_fact']
    }
  },
  {
    id: 'L-thermal-energy-is-kinetic',
    expectation: 'L; thermal/GPE adversarial boundary',
    prompt: 'For this class, is thermal energy kinetic or potential energy?',
    studentPath: true,
    expected: {
      taskType: 'binary_classification',
      candidateTopics: ['energy'],
      targetConcept: 'thermal_energy',
      requiredAnswerPatterns: [/\bthermal energy\b/i, /\bkinetic(?: energy)?\b/i],
      forbiddenAnswerPatterns: [
        /\bthermal energy is potential\b/i,
        /\bgravitational potential energy\b/i,
        /\bGPE\b/
      ],
      forbiddenTools: ['local_periodic_table'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['binary_classification', 'science_concept', 'definition', 'class_fact']
    }
  },
  {
    id: 'L-radiant-energy-is-kinetic',
    expectation: 'L',
    prompt: 'For this class, is radiant energy kinetic or potential energy?',
    studentPath: true,
    expected: {
      taskType: 'binary_classification',
      candidateTopics: ['energy'],
      targetConcept: 'radiant_energy',
      requiredAnswerPatterns: [/\bradiant energy\b/i, /\bkinetic(?: energy)?\b/i],
      forbiddenAnswerPatterns: [/\bradiant energy is potential\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['binary_classification', 'science_concept', 'definition', 'class_fact']
    }
  },
  {
    id: 'M-electric-field-not-voltage',
    expectation: 'M; electric-field/voltage adversarial boundary',
    prompt: 'This exerts a force that causes other electric charges to move.',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['circuits'],
      targetConcept: 'electric_field',
      requiredAnswerPatterns: [/\belectric field\b/i],
      forbiddenAnswerPatterns: [
        /^Voltage(?: difference)? is\b/i,
        /\bmeasured in volts?\b/i
      ],
      forbiddenUnits: ['V'],
      requiredTools: [/^(?:teacher_approved_answer_rules|electricity_magnetism_knowledge_pack)$/],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze', 'cloze_completion', 'definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'N-tarnishing-is-chemical-property',
    expectation: 'N',
    prompt: 'Silver tarnishes when exposed to air and light. A chemical property is ____.',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['matter'],
      targetConcept: 'tarnishing',
      requiredAnswerPatterns: [/\btarnish(?:ing|es)?\b/i],
      forbiddenAnswerPatterns: [/\bphysical propert(?:y|ies)\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze', 'cloze_completion', 'definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'O-malleability-ductility-physical-properties',
    expectation: 'O',
    prompt: 'Malleability and ductility are examples of ____ properties.',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['matter'],
      targetConcept: 'physical_properties',
      requiredAnswerPatterns: [/\bphysical propert(?:y|ies)\b/i],
      forbiddenAnswerPatterns: [/\bchemical propert(?:y|ies)\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze', 'cloze_completion', 'definition', 'science_concept', 'class_fact']
    }
  },

  // Positive sides of the required adversarial boundaries.
  {
    id: 'boundary-periodic-table-positive',
    expectation: 'table/periodic-table positive control',
    prompt: 'How is the periodic table organized into groups and periods?',
    studentPath: true,
    expected: {
      taskType: 'definition',
      candidateTopics: ['atomic_structure'],
      targetConcept: 'periodic_table',
      requiredAnswerPatterns: [/\bperiodic table\b/i, /\bgroups?\b/i, /\bperiods?\b/i],
      forbiddenAnswerPatterns: [/\bNewton(?:'s|s)? First Law\b/i, /\blamp\b/i],
      requiredTools: [/^(?:unit7_atomic_structure_knowledge|local_periodic_table)$/],
      forbiddenTools: ['physics_forces_vocab'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'boundary-voltage-difference-positive',
    expectation: 'force/voltage and electric-field/voltage positive control',
    prompt: 'What is voltage difference in an electric circuit?',
    studentPath: true,
    expected: {
      taskType: 'definition',
      candidateTopics: ['circuits'],
      targetConcept: 'voltage_difference',
      requiredAnswerPatterns: [/\bvoltage(?: difference)?\b/i, /\bvolts?\b|\belectric potential\b/i],
      forbiddenAnswerPatterns: [/^Force is a push or pull\b/i, /^An electric field is\b/i],
      requiredTools: [/^(?:electricity_magnetism_knowledge_pack|teacher_facts)$/],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'boundary-conductor-positive',
    expectation: 'current/conductor positive control',
    prompt: 'What is a conductor in an electric circuit?',
    studentPath: true,
    expected: {
      taskType: 'definition',
      candidateTopics: ['circuits'],
      targetConcept: 'conductor',
      requiredAnswerPatterns: [/\bconductor\b/i, /\b(?:charge|electrons?|current)\b/i],
      forbiddenAnswerPatterns: [/\bcurrent is the (?:rate|flow)\b/i],
      requiredTools: [/^(?:electricity_magnetism_knowledge_pack|teacher_facts)$/],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'boundary-gpe-positive',
    expectation: 'thermal/GPE positive control',
    prompt: 'A book held above the floor has what kind of potential energy?',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['energy'],
      targetConcept: 'gravitational_potential_energy',
      requiredAnswerPatterns: [/\bgravitational potential energy\b/i],
      forbiddenAnswerPatterns: [/\bthermal energy is kinetic\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze', 'cloze_completion', 'definition', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'boundary-earth-surface-gravity-positive',
    expectation: 'Moon/Earth gravity positive control',
    prompt: 'What is the gravitational acceleration near Earth’s surface?',
    studentPath: true,
    expected: {
      taskType: 'definition',
      candidateTopics: ['gravity'],
      targetConcept: 'earth_surface_gravity',
      requiredAnswerPatterns: [/\b9\.?8\s*m\s*\/\s*s(?:²|\^?2)/i],
      forbiddenAnswerPatterns: [/\bMoon is much less massive\b/i],
      requiredUnits: ['m/s²'],
      requiredTools: ['science_formula_rules'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['science_formula', 'definition', 'science_concept']
    }
  },

  // Missing-information pairs must stay safe through graph replacement.
  {
    id: 'boundary-multiple-choice-missing-choices',
    expectation: 'missing choices fail closed',
    prompt: 'Which of the following materials is a conductor?',
    studentPath: true,
    expected: {
      taskType: 'multiple_choice',
      candidateTopics: ['circuits'],
      targetConcept: 'conductor',
      requiredAnswerPatterns: [/\b(?:provide|share|send|include|need)\b[\s\S]*\bchoices?\b|\bwhat are the choices\b/i],
      forbiddenAnswerPatterns: [
        /\bthe answer is (?:B|copper)\b/i,
        /\bCopper is the correct\b/i,
        /Conductors are materials that allow electrons to flow easily/i
      ],
      clarificationRequired: true,
      maxConfidence: 'none',
      allowedRouteTypes: ['clarification', 'missing_context', 'no_match', 'multiple_choice']
    }
  },
  {
    id: 'boundary-multiple-choice-supplied-choices',
    expectation: 'supplied choices positive control',
    prompt: 'Which material is a conductor? A. Rubber B. Copper C. Glass D. Dry wood',
    studentPath: true,
    expected: {
      taskType: 'multiple_choice',
      candidateTopics: ['circuits'],
      targetConcept: 'conductor',
      requiredAnswerPatterns: [/\bB\b[\s.):,-]*\s*Copper\b|\bCopper\b/i],
      forbiddenAnswerPatterns: [/\bprovide\b[\s\S]*\bchoices?\b|\bwhat are the choices\b/i],
      requiredTools: [/^(?:teacher_approved_answer_rules|electricity_magnetism_knowledge_pack|teacher_facts)$/],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['multiple_choice', 'science_concept', 'class_fact', 'definition']
    }
  },
  {
    id: 'boundary-unseen-diagram-required',
    expectation: 'missing diagram fails closed',
    prompt: 'In the diagram above, which bulb will light?',
    studentPath: true,
    expected: {
      taskType: 'diagram_required',
      candidateTopics: ['circuits'],
      targetConcept: 'circuit_state',
      requiredAnswerPatterns: [/\b(?:provide|share|send|upload|show|need)\b[\s\S]*\bdiagram\b|\bdescribe\b[\s\S]*\bcircuit\b/i],
      forbiddenAnswerPatterns: [
        /\bBulb [A-D] will light\b/i,
        /\bthe (?:first|second|left|right) bulb will light\b/i
      ],
      clarificationRequired: true,
      maxConfidence: 'none',
      allowedRouteTypes: ['clarification', 'missing_context', 'no_match', 'diagram_required']
    }
  },
  {
    id: 'boundary-draw-diagram-request',
    expectation: 'draw request is not a missing-diagram question',
    prompt: 'Draw a circuit diagram with one battery, one closed switch, and one light bulb.',
    studentPath: true,
    expected: {
      taskType: 'draw_diagram',
      candidateTopics: ['circuits'],
      targetConcept: 'circuit_diagram',
      requiredAnswerPatterns: [/\bbattery\b/i, /\b(?:closed )?switch\b/i, /\b(?:light )?bulb\b/i],
      forbiddenAnswerPatterns: [
        /\bprovide\b[\s\S]*\bdiagram\b/i,
        /\bupload\b[\s\S]*\bdiagram\b/i,
        /\bI need to see the diagram\b/i
      ],
      requiredTools: [/^(?:circuit_diagram_rules|teacher_approved_answer_rules)$/],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['circuit_diagram', 'draw_diagram', 'diagram_required', 'science_concept', 'class_fact']
    }
  },
  {
    id: 'review-paraphrase-unequal-directional-forces',
    expectation: 'independent review paraphrase',
    prompt: 'One force is 8 N east and another is 3 N west. Are the forces balanced?',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['forces'],
      targetConcept: 'unbalanced_forces',
      requiredAnswerPatterns: [/\bunbalanced forces?\b/i, /\bnet force\b/i],
      forbiddenAnswerPatterns: [/\bbalanced forces cancel\b/i, /\bvoltage\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze_completion']
    }
  },
  {
    id: 'review-paraphrase-resting-book',
    expectation: 'independent review paraphrase',
    prompt: 'A book remains still on a desk. Which Newton law does this illustrate?',
    studentPath: true,
    expected: {
      taskType: 'law_identification',
      candidateTopics: ['newtons_laws'],
      targetConcept: 'newtons_first_law',
      requiredAnswerPatterns: [/Newton(?:['’]s|s)?\s+First Law/i, /\bbalanced\b/i],
      forbiddenAnswerPatterns: [/\bperiodic table\b/i, /\bvalence electrons?\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['law_identification']
    }
  },
  {
    id: 'review-paraphrase-moon-jump',
    expectation: 'independent review paraphrase',
    prompt: 'Why can astronauts jump higher on the Moon than on Earth?',
    studentPath: true,
    expected: {
      taskType: 'explanation',
      candidateTopics: ['gravity'],
      targetConcept: 'moon_gravity',
      requiredAnswerPatterns: [/\bMoon\b/i, /\bless massive\b|\bless mass\b/i],
      forbiddenAnswerPatterns: [/\bMoon\b[\s\S]{0,40}\b9\.?8\s*m\/s/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['science_concept']
    }
  },
  {
    id: 'review-paraphrase-current-through-wire',
    expectation: 'independent review paraphrase',
    prompt: 'What do we call the movement of electric charge through a wire?',
    studentPath: true,
    expected: {
      taskType: 'explanation',
      candidateTopics: ['circuits'],
      targetConcept: 'electric_current',
      requiredAnswerPatterns: [/\belectric current\b/i, /\bflow of electric charge\b/i],
      forbiddenAnswerPatterns: [/^Electric charge is a property\b/i, /^A conductor is\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze_completion']
    }
  },
  {
    id: 'review-paraphrase-voltage-not-mechanical-force',
    expectation: 'independent review paraphrase',
    prompt: 'Explain voltage without confusing it with mechanical force.',
    studentPath: true,
    expected: {
      taskType: 'explanation',
      candidateTopics: ['circuits'],
      targetConcept: 'voltage_difference',
      requiredAnswerPatterns: [/\bvoltage\b/i, /\belectric potential difference\b/i],
      forbiddenAnswerPatterns: [/^A force is a push or pull\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['science_concept']
    }
  },
  {
    id: 'review-paraphrase-explicit-circuit-image',
    expectation: 'independent review missing-diagram paraphrase',
    prompt: 'Look at this circuit image: which lamps are on?',
    studentPath: true,
    expected: {
      taskType: 'diagram_required',
      candidateTopics: ['electricity'],
      targetConcept: '',
      requiredAnswerPatterns: [/\bneed\b[\s\S]*\bdiagram\b|\bdescribe\b[\s\S]*\bcircuit\b/i],
      forbiddenAnswerPatterns: [/\blamp [A-D]\b[\s\S]*\b(?:on|light)\b/i],
      clarificationRequired: true,
      maxConfidence: 'none',
      allowedRouteTypes: ['missing_context']
    }
  },
  {
    id: 'review-periodic-table-row-positive',
    expectation: 'independent review periodic-table positive control',
    prompt: 'What does a row on the periodic table tell you about electron energy levels?',
    studentPath: true,
    expected: {
      taskType: 'definition',
      candidateTopics: ['atomic_structure'],
      targetConcept: 'periodic_period',
      requiredAnswerPatterns: [/\bperiod\b|\brow\b/i, /\benergy levels?\b/i],
      forbiddenAnswerPatterns: [/Newton(?:['’]s|s)?\s+First Law/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['science_concept']
    }
  },
  {
    id: 'review-paraphrase-first-law-zero-net-force',
    expectation: 'independent review first-law paraphrase',
    prompt: 'Which Newton law describes an object staying at rest when the net force is zero?',
    studentPath: true,
    expected: {
      taskType: 'law_identification',
      candidateTopics: ['newtons_laws'],
      targetConcept: 'newtons_first_law',
      requiredAnswerPatterns: [/Newton(?:['’]s|s)?\s+First Law/i, /\bnet force is 0 N\b/i],
      forbiddenAnswerPatterns: [/Newton(?:['’]s|s)?\s+Second Law/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['law_identification']
    }
  },
  {
    id: 'review-paraphrase-lunar-fall',
    expectation: 'independent review lunar-gravity paraphrase',
    prompt: 'Explain why objects fall more slowly on the lunar surface.',
    studentPath: true,
    expected: {
      taskType: 'explanation',
      candidateTopics: ['gravity'],
      targetConcept: 'moon_gravity',
      requiredAnswerPatterns: [/\bMoon\b/i, /\bless massive\b|\bless mass\b/i],
      forbiddenAnswerPatterns: [/\bcompound is a substance\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['science_concept']
    }
  },
  {
    id: 'review-paraphrase-ohms-law-voltage',
    expectation: 'teacher rule must not intercept a voltage calculation',
    prompt: 'If current is 3 A through a 4 ohm resistor, what is the voltage?',
    studentPath: true,
    expected: {
      taskType: 'calculation',
      candidateTopics: ['circuits'],
      targetConcept: 'voltage_difference',
      requiredAnswerPatterns: [/\bV\s*=\s*I\s*[×*]\s*R\b/i, /\b12\s*V\b/i],
      forbiddenAnswerPatterns: [/\bI\s*=\s*V\s*\/\s*R\b/i],
      requiredUnits: ['V'],
      requiredTools: ['science_formula_rules'],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['science_formula']
    }
  },
  {
    id: 'review-paraphrase-sound-wave-energy',
    expectation: 'independent review cross-topic wave paraphrase',
    prompt: 'How can a sound wave carry energy through matter?',
    studentPath: true,
    expected: {
      taskType: 'explanation',
      candidateTopics: ['waves'],
      targetConcept: 'wave',
      requiredAnswerPatterns: [/\bwave\b/i, /\bcarries energy\b/i],
      forbiddenAnswerPatterns: [/\bAtoms are the tiny particles\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['cloze_completion']
    }
  },
  {
    id: 'review-cross-topic-comparison-fails-closed',
    expectation: 'single-topic answer cannot satisfy an explicit cross-topic comparison',
    prompt: 'Compare the force on a charged object in an electric field with gravity.',
    studentPath: true,
    expected: {
      taskType: 'explanation',
      candidateTopics: ['circuits', 'forces', 'gravity'],
      targetConcept: 'electric_field',
      requiredAnswerPatterns: [/\btrusted answer\b|\btrusted local science fact\b/i],
      forbiddenAnswerPatterns: [/^The answer is electric field\./i],
      clarificationRequired: false,
      maxConfidence: 'none',
      allowedRouteTypes: ['no_match']
    }
  },
  {
    id: 'review-missing-choice-these',
    expectation: 'underspecified demonstrative choice question asks for choices',
    prompt: 'Which of these is a conductor?',
    studentPath: true,
    expected: {
      taskType: 'multiple_choice',
      candidateTopics: ['circuits'],
      targetConcept: 'conductor',
      requiredAnswerPatterns: [/\bneed\b[\s\S]*\banswer choices\b/i],
      forbiddenAnswerPatterns: [/\bCopper is the conductor\b/i],
      clarificationRequired: true,
      maxConfidence: 'none',
      allowedRouteTypes: ['missing_context']
    }
  },
  {
    id: 'review-missing-circuit-shown',
    expectation: 'referenced circuit without an attachment asks for the diagram',
    prompt: 'In the circuit shown, which bulb is brightest?',
    studentPath: true,
    expected: {
      taskType: 'diagram_required',
      candidateTopics: ['electricity'],
      targetConcept: '',
      requiredAnswerPatterns: [/\bneed to see\b[\s\S]*\bdiagram\b/i],
      forbiddenAnswerPatterns: [/\bbrightest bulb is\b/i],
      clarificationRequired: true,
      maxConfidence: 'none',
      allowedRouteTypes: ['missing_context']
    }
  },
  {
    id: 'review-paraphrase-voltage-push',
    expectation: 'independent review voltage clue paraphrase',
    prompt: 'What pushes electric charge through a circuit?',
    studentPath: true,
    expected: {
      taskType: 'cloze',
      candidateTopics: ['circuits'],
      targetConcept: 'voltage_difference',
      requiredAnswerPatterns: [/\bvoltage\b/i, /\belectric potential difference\b/i],
      forbiddenAnswerPatterns: [/^A force is a push or pull\b/i],
      clarificationRequired: false,
      maxConfidence: 'strong',
      allowedRouteTypes: ['science_concept']
    }
  }
];

module.exports = {
  answerSafetyCases: deepFreeze(answerSafetyCases)
};

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key]));
  return Object.freeze(value);
}
